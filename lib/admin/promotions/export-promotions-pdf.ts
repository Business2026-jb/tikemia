import "server-only";

import {
  PDFDocument,
  StandardFonts,
  rgb,
} from "pdf-lib";

import { AdminPromotionError } from "@/lib/admin/promotions/admin-promotion-errors";
import {
  getAdminPromotions,
  type GetAdminPromotionsInput,
} from "@/lib/admin/promotions/get-admin-promotions";
import { getAdminPromotionStatistics } from "@/lib/admin/promotions/get-admin-promotion-statistics";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

function truncate(value: string, maximum: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= maximum
    ? normalized
    : `${normalized.slice(0, maximum - 3)}...`;
}

export async function exportPromotionsPdf(
  input: GetAdminPromotionsInput = {},
) {
  try {
    const [result, statistics] = await Promise.all([
      getAdminPromotions({
        ...input,
        page: 1,
        pageSize: 100,
      }),
      getAdminPromotionStatistics(input),
    ]);

    const pdf = await PDFDocument.create();
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const width = 841.89;
    const height = 595.28;
    const margin = 28;
    const rowHeight = 22;

    let page = pdf.addPage([width, height]);
    let y = height - 45;

    const drawHeader = () => {
      page.drawRectangle({
        x: 0,
        y: 0,
        width,
        height,
        color: rgb(0.02, 0.04, 0.05),
      });

      page.drawText("TIKEMIA", {
        x: margin,
        y: height - 40,
        size: 21,
        font: bold,
        color: rgb(0.64, 0.90, 0.20),
      });

      page.drawText("RAPPORT DES PROMOTIONS D'EVENEMENTS", {
        x: margin,
        y: height - 65,
        size: 14,
        font: bold,
        color: rgb(1, 1, 1),
      });

      page.drawText(
        `Total: ${statistics.totalPromotions} | Actives: ${statistics.activePromotions} | Programmees: ${statistics.scheduledPromotions}`,
        {
          x: margin,
          y: height - 84,
          size: 8,
          font: regular,
          color: rgb(0.65, 0.70, 0.73),
        },
      );

      y = height - 108;
      page.drawRectangle({
        x: margin,
        y: y - rowHeight,
        width: width - margin * 2,
        height: rowHeight,
        color: rgb(0.05, 0.09, 0.11),
      });

      const headers = [
        [margin + 6, "Evenement"],
        [margin + 205, "Organisateur"],
        [margin + 365, "Statut"],
        [margin + 450, "Priorite"],
        [margin + 525, "Debut"],
        [margin + 615, "Fin"],
        [margin + 705, "Source"],
      ] as const;

      for (const [x, label] of headers) {
        page.drawText(label, {
          x,
          y: y - 15,
          size: 7,
          font: bold,
          color: rgb(1, 1, 1),
        });
      }

      y -= rowHeight;
    };

    drawHeader();

    result.promotions.forEach((promotion, index) => {
      if (y - rowHeight < 35) {
        page = pdf.addPage([width, height]);
        drawHeader();
      }

      if (index % 2 === 1) {
        page.drawRectangle({
          x: margin,
          y: y - rowHeight,
          width: width - margin * 2,
          height: rowHeight,
          color: rgb(0.03, 0.065, 0.075),
        });
      }

      const cells = [
        [margin + 6, truncate(promotion.event.title, 30)],
        [
          margin + 205,
          truncate(
            promotion.organizer.businessName ||
              promotion.organizer.fullName,
            23,
          ),
        ],
        [margin + 365, promotion.status],
        [margin + 450, String(promotion.priorityScore)],
        [margin + 525, formatDate(promotion.startsAt)],
        [margin + 615, formatDate(promotion.endsAt)],
        [margin + 705, promotion.source],
      ] as const;

      for (const [x, value] of cells) {
        page.drawText(value, {
          x,
          y: y - 15,
          size: 7,
          font: regular,
          color: rgb(0.82, 0.87, 0.89),
        });
      }

      y -= rowHeight;
    });

    const pages = pdf.getPages();

    pages.forEach((current, index) => {
      current.drawText(`Page ${index + 1} / ${pages.length}`, {
        x: width - margin - 70,
        y: 14,
        size: 7,
        font: regular,
        color: rgb(0.45, 0.50, 0.53),
      });
    });

    const bytes = await pdf.save();

    return {
      bytes: Uint8Array.from(bytes),
      fileName: `rapport-promotions-tikemia-${new Date()
        .toISOString()
        .slice(0, 10)}.pdf`,
      mimeType: "application/pdf" as const,
      promotionsCount: result.promotions.length,
    };
  } catch (error) {
    if (error instanceof AdminPromotionError) throw error;

    throw new AdminPromotionError({
      code: "ADMIN_PROMOTION_EXPORT_FAILED",
      message: "Impossible de générer le rapport PDF des promotions.",
      status: 500,
      cause: error,
    });
  }
}
