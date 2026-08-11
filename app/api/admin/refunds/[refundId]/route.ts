import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin/require-admin";
import { getAdminRefund } from "@/lib/admin/refunds/get-admin-refund";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = Readonly<{
  params: Promise<{ refundId: string }>;
}>;

function noStoreHeaders(): HeadersInit {
  return {
    "Cache-Control":
      "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
    "X-Content-Type-Options": "nosniff",
  };
}

function jsonResponse<T extends object>(
  body: T,
  status = 200,
): NextResponse<T> {
  return NextResponse.json(body, {
    status,
    headers: noStoreHeaders(),
  });
}

async function requireRefundAdmin() {
  return requireAdmin();
}


function normalizeRefundId(value: string | null | undefined): string {
  return value?.trim().slice(0, 120) ?? "";
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  try {
    await requireRefundAdmin();

    const { refundId: rawRefundId } = await context.params;
    const refundId = normalizeRefundId(rawRefundId);

    if (!refundId) {
      return jsonResponse(
        {
          success: false,
          code: "REFUND_ID_REQUIRED",
          message: "L’identifiant de la demande de remboursement est obligatoire.",
        },
        400,
      );
    }

    const refund = await getAdminRefund({ refundId });

    if (!refund) {
      return jsonResponse(
        {
          success: false,
          code: "REFUND_NOT_FOUND",
          message: "Cette demande de remboursement est introuvable.",
        },
        404,
      );
    }

    return jsonResponse({
      success: true,
      data: { refund },
    });
  } catch (error) {
    console.error(
      "[ADMIN_REFUND_DETAILS_ERROR]",
      error instanceof Error
        ? { name: error.name, message: error.message }
        : error,
    );

    return jsonResponse(
      {
        success: false,
        code: "ADMIN_REFUND_DETAILS_LOAD_FAILED",
        message: "Impossible de charger cette demande de remboursement pour le moment.",
      },
      500,
    );
  }
}
