import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/admin/require-admin";
import {
  AdminRefundApprovalError,
  approveRefund,
} from "@/lib/admin/refunds/approve-refund";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

const MAX_REQUEST_BODY_BYTES = 16 * 1024;

const approveSchema = z
  .object({
    note: z.string().trim().max(1_500).optional().nullable(),
  })
  .strict();

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

function contentLength(request: NextRequest): number | null {
  const raw = request.headers.get("content-length");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  try {
    const adminSession = await requireRefundAdmin();
    const { refundId: rawRefundId } = await context.params;
    const refundId = normalizeRefundId(rawRefundId);

    if (!refundId) {
      return jsonResponse(
        { success: false, code: "REFUND_ID_REQUIRED", message: "L’identifiant de la demande de remboursement est obligatoire." },
        400,
      );
    }

    const length = contentLength(request);
    if (length !== null && length > MAX_REQUEST_BODY_BYTES) {
      return jsonResponse(
        { success: false, code: "REQUEST_TOO_LARGE", message: "La requête est trop volumineuse." },
        413,
      );
    }

    let body: unknown = {};
    const rawBody = await request.text();
    if (rawBody.trim()) {
      try {
        body = JSON.parse(rawBody) as unknown;
      } catch {
        return jsonResponse(
          { success: false, code: "INVALID_JSON", message: "Le contenu de la requête n’est pas un JSON valide." },
          400,
        );
      }
    }

    const parsed = approveSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(
        {
          success: false,
          code: "INVALID_APPROVAL_REQUEST",
          message: parsed.error.issues[0]?.message ?? "La demande d’approbation est invalide.",
        },
        400,
      );
    }

    const result = await approveRefund({
      adminId: adminSession.admin.id,
      refundId,
      note: parsed.data.note ?? null,
    });

    return jsonResponse({
      success: true,
      message: "La demande de remboursement a été approuvée et placée en traitement.",
      data: { refund: result },
    });
  } catch (error) {
    if (error instanceof AdminRefundApprovalError) {
      return jsonResponse(
        { success: false, code: error.code, message: error.message },
        error.status,
      );
    }

    console.error(
      "[ADMIN_REFUND_APPROVE_ERROR]",
      error instanceof Error ? { name: error.name, message: error.message } : error,
    );

    return jsonResponse(
      { success: false, code: "REFUND_APPROVAL_FAILED", message: "Impossible d’approuver cette demande de remboursement pour le moment." },
      500,
    );
  }
}
