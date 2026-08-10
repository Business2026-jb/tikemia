import "server-only";

import {
  PDFDocument,
  StandardFonts,
  rgb,
} from "pdf-lib";

import { AdminCouponError } from "@/lib/admin/coupons/admin-coupon-errors";
import {
  getAdminCoupons,
  type GetAdminCouponsInput,
} from "@/lib/admin/coupons/get-admin-coupons";
import { getAdminCouponStatistics } from "@/lib/admin/coupons/get-admin-coupon-statistics";

function truncate(value: string, max: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();

  return normalized.length <= max
    ? normalized
    : `${normalized.slice(0, max - 3)}...`;
}

export async function exportCouponsPdf(
  input: GetAdminCouponsInput = {},
) {
  try {
    const [result, statistics] = await Promise.all([
      getAdminCoupons({
        ...input,
        page: 1,
        pageSize: 100,
      }),
      getAdminCouponStatistics(input),
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

    function header() {
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

      page.drawText("RAPPORT DES CODES PROMO", {
        x: margin,
        y: height - 65,
        size: 14,
        font: bold,
        color: rgb(1, 1, 1),
      });

      page.drawText(
        `Total: ${statistics.totalCoupons} | Actifs: ${statistics.activeCoupons} | Utilisations: ${statistics.totalUses}`,
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

      const labels = [
        [margin + 6, "Code"],
        [margin + 105, "Evenement"],
        [margin + 315, "Organisateur"],
        [margin + 485, "Type"],
        [margin + 575, "Valeur"],
        [margin + 650, "Usages"],
        [margin + 720, "Statut"],
      ] as const;

      for (const [x, label] of labels) {
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

    header();

    result.coupons.forEach((coupon, index) => {
      if (y - rowHeight < 35) {
        page = pdf.addPage([width, height]);
        header();
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

      const value =
        coupon.discountType === "PERCENTAGE"
          ? `${coupon.discountValue} %`
          : `${coupon.discountValue} ${coupon.event.currency}`;

      const cells = [
        [margin + 6, truncate(coupon.code, 14)],
        [margin + 105, truncate(coupon.event.title, 30)],
        [
          margin + 315,
          truncate(
            coupon.organizer.businessName ||
              coupon.organizer.fullName,
            24,
          ),
        ],
        [margin + 485, coupon.discountType],
        [margin + 575, value],
        [
          margin + 650,
          `${coupon.currentUses}/${coupon.maximumUses ?? "∞"}`,
        ],
        [margin + 720, coupon.status],
      ] as const;

      for (const [x, text] of cells) {
        page.drawText(text, {
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
      fileName:
        `rapport-coupons-tikemia-${new Date()
          .toISOString()
          .slice(0, 10)}.pdf`,
      mimeType: "application/pdf" as const,
      couponsCount: result.coupons.length,
    };
  } catch (error) {
    if (error instanceof AdminCouponError) throw error;

    throw new AdminCouponError({
      code: "ADMIN_COUPON_EXPORT_FAILED",
      message:
        "Impossible de générer le rapport PDF des codes promo.",
      status: 500,
      cause: error,
    });
  }
}
