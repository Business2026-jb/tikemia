import "server-only";

import {
  PDFDocument,
  StandardFonts,
  rgb,
} from "pdf-lib";

import { AdminMarketingError } from "@/lib/admin/marketing/admin-marketing-errors";
import {
  getAdminMarketingCampaigns,
  type GetAdminMarketingCampaignsInput,
} from "@/lib/admin/marketing/get-admin-marketing-campaigns";
import { getAdminMarketingStatistics } from "@/lib/admin/marketing/get-admin-marketing-statistics";

function truncate(value: string, max: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();

  return normalized.length <= max
    ? normalized
    : `${normalized.slice(0, max - 3)}...`;
}

function formatDate(value: Date | null): string {
  if (!value) return "-";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

export async function exportMarketingPdf(
  input: GetAdminMarketingCampaignsInput = {},
) {
  try {
    const [result, statistics] = await Promise.all([
      getAdminMarketingCampaigns({
        ...input,
        page: 1,
        pageSize: 100,
      }),
      getAdminMarketingStatistics(input),
    ]);

    const pdf = await PDFDocument.create();
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const width = 841.89;
    const height = 595.28;
    const margin = 28;
    const rowHeight = 23;

    let page = pdf.addPage([width, height]);
    let y = height - 45;

    function drawHeader() {
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
        color: rgb(0.64, 0.9, 0.2),
      });

      page.drawText("RAPPORT DES CAMPAGNES MARKETING", {
        x: margin,
        y: height - 65,
        size: 14,
        font: bold,
        color: rgb(1, 1, 1),
      });

      page.drawText(
        `Total: ${statistics.totalCampaigns} | Actives: ${statistics.activeCampaigns} | Visites: ${statistics.totalVisits} | Commandes: ${statistics.totalOrders}`,
        {
          x: margin,
          y: height - 84,
          size: 8,
          font: regular,
          color: rgb(0.65, 0.7, 0.73),
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

      const headers: readonly [number, string][] = [
        [margin + 6, "Campagne"],
        [margin + 170, "Evenement"],
        [margin + 330, "Organisateur"],
        [margin + 485, "Canal"],
        [margin + 565, "Budget"],
        [margin + 650, "Visites"],
        [margin + 705, "Statut"],
      ];

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
    }

    drawHeader();

    result.campaigns.forEach((campaign, index) => {
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

      const cells: readonly [number, string][] = [
        [margin + 6, truncate(campaign.name, 24)],
        [margin + 170, truncate(campaign.event.title, 23)],
        [
          margin + 330,
          truncate(
            campaign.organizer.businessName ||
              campaign.organizer.fullName,
            22,
          ),
        ],
        [margin + 485, campaign.channel],
        [
          margin + 565,
          campaign.budget
            ? `${campaign.budget} ${campaign.currency}`
            : "-",
        ],
        [margin + 650, String(campaign.metrics.visits)],
        [margin + 705, campaign.status],
      ];

      for (const [x, cell] of cells) {
        page.drawText(cell, {
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
        color: rgb(0.45, 0.5, 0.53),
      });
    });

    const bytes = await pdf.save();

    return {
      bytes: Uint8Array.from(bytes),
      fileName: `rapport-marketing-tikemia-${new Date()
        .toISOString()
        .slice(0, 10)}.pdf`,
      mimeType: "application/pdf" as const,
      campaignsCount: result.campaigns.length,
    };
  } catch (error) {
    if (error instanceof AdminMarketingError) {
      throw error;
    }

    throw new AdminMarketingError({
      code: "ADMIN_MARKETING_EXPORT_FAILED",
      message:
        "Impossible de générer le rapport PDF des campagnes marketing.",
      status: 500,
      cause: error,
    });
  }
}
