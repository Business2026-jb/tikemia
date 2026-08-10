import {
  NextResponse,
} from "next/server";

import {
  serializeAdminPromotionError,
} from "@/lib/admin/promotions/admin-promotion-errors";
import {
  getAdminPromotion,
} from "@/lib/admin/promotions/get-admin-promotion";
import {
  requireAdmin,
} from "@/lib/admin/require-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

type RouteContext = Readonly<{
  params: Promise<{
    promotionId: string;
  }>;
}>;

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
    },
  });
}

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    await requireAdmin();

    const { promotionId } =
      await context.params;

    const data =
      await getAdminPromotion(
        decodeURIComponent(
          promotionId,
        ).trim(),
      );

    return jsonResponse({
      success: true,
      data,
    });
  } catch (error) {
    console.error(
      "[ADMIN_PROMOTION_DETAIL_ERROR]",
      error,
    );

    const serialized =
      serializeAdminPromotionError(error);

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
