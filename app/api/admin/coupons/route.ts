import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { serializeAdminCouponError } from "@/lib/admin/coupons/admin-coupon-errors";
import { getAdminCoupons } from "@/lib/admin/coupons/get-admin-coupons";
import { requireAdmin } from "@/lib/admin/require-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

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
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control":
        "private, no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin();

    const parsed = querySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    if (!parsed.success) {
      return jsonResponse(
        {
          success: false,
          error: {
            code: "ADMIN_COUPON_QUERY_INVALID",
            message:
              parsed.error.issues[0]?.message ||
              "Les paramètres de recherche sont invalides.",
            details: parsed.error.flatten().fieldErrors,
          },
        },
        422,
      );
    }

    const result = await getAdminCoupons({
      search: parsed.data.search || null,
      status: parsed.data.status,
      discountType: parsed.data.discountType,
      organizerId: parsed.data.organizerId || null,
      eventId: parsed.data.eventId || null,
      country: parsed.data.country || null,
      startsFrom: parsed.data.startsFrom || null,
      startsTo: parsed.data.startsTo || null,
      sort: parsed.data.sort,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    });

    return jsonResponse({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[ADMIN_COUPONS_LIST_ERROR]", error);

    const serialized = serializeAdminCouponError(error);

    return jsonResponse(
      {
        success: false,
        error: {
          code: serialized.code,
          message: serialized.message,
          details: serialized.details ?? null,
        },
      },
      serialized.status,
    );
  }
}
