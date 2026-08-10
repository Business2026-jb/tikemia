import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { serializeAdminCouponError } from "@/lib/admin/coupons/admin-coupon-errors";
import { exportCouponsPdf } from "@/lib/admin/coupons/export-coupons-pdf";
import { requireAdmin } from "@/lib/admin/require-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

const querySchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: z
    .enum(["all", "ACTIVE", "SCHEDULED", "DISABLED", "EXPIRED", "ARCHIVED"])
    .default("all"),
  discountType: z
    .enum(["all", "PERCENTAGE", "FIXED_AMOUNT"])
    .default("all"),
  organizerId: z.string().trim().max(200).optional(),
  eventId: z.string().trim().max(200).optional(),
  country: z.string().trim().max(120).optional(),
  startsFrom: z.string().trim().max(50).optional(),
  startsTo: z.string().trim().max(50).optional(),
  sort: z
    .enum([
      "recent",
      "oldest",
      "most_used",
      "least_used",
      "ending_soon",
      "value_desc",
      "value_asc",
    ])
    .default("recent"),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin();

    const parsed = querySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "ADMIN_COUPON_QUERY_INVALID",
            message:
              parsed.error.issues[0]?.message ||
              "Les paramètres d’export sont invalides.",
          },
        },
        { status: 422 },
      );
    }

    const result = await exportCouponsPdf({
      search: parsed.data.search || null,
      status: parsed.data.status,
      discountType: parsed.data.discountType,
      organizerId: parsed.data.organizerId || null,
      eventId: parsed.data.eventId || null,
      country: parsed.data.country || null,
      startsFrom: parsed.data.startsFrom || null,
      startsTo: parsed.data.startsTo || null,
      sort: parsed.data.sort,
    });

    return new NextResponse(result.bytes, {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
        "Content-Length": String(result.bytes.byteLength),
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[ADMIN_COUPONS_EXPORT_ERROR]", error);

    const serialized = serializeAdminCouponError(error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: serialized.code,
          message: serialized.message,
          details: serialized.details ?? null,
        },
      },
      { status: serialized.status },
    );
  }
}
