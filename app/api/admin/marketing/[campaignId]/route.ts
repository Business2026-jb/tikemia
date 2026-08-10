import { NextResponse } from "next/server";

import { serializeAdminMarketingError } from "@/lib/admin/marketing/admin-marketing-errors";
import { getAdminMarketingCampaign } from "@/lib/admin/marketing/get-admin-marketing-campaign";
import { requireAdmin } from "@/lib/admin/require-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

type RouteContext = Readonly<{
  params: Promise<{
    campaignId: string;
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

    const { campaignId } = await context.params;

    const result = await getAdminMarketingCampaign(
      decodeURIComponent(campaignId).trim(),
    );

    return jsonResponse({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[ADMIN_MARKETING_DETAIL_ERROR]", error);

    const serialized = serializeAdminMarketingError(error);

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
