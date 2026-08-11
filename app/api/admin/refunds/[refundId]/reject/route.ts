import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/admin/require-admin";
import {
  AdminRefundRejectionError,
  rejectRefund,
} from "@/lib/admin/refunds/reject-refund";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

const MAX_REQUEST_BODY_BYTES = 16 * 1024;

const rejectSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(10, "Le motif du refus doit contenir au moins 10 caractères.")
      .max(1_500, "Le motif du refus ne peut pas dépasser 1500 caractères."),
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(
        { success: false, code: "INVALID_JSON", message: "Le contenu de la requête n’est pas un JSON valide." },
        400,
      );
    }

    const parsed = rejectSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(
        {
          success: false,
          code: "INVALID_REJECTION_REQUEST",
          message: parsed.error.issues[0]?.message ?? "Le motif du refus est invalide.",
        },
        400,
      );
    }

    const result = await rejectRefund({
      adminId: adminSession.admin.id,
      refundId,
      reason: parsed.data.reason,
    });

    return jsonResponse({
      success: true,
      message: "La demande de remboursement a été refusée.",
      data: { refund: result },
    });
  } catch (error) {
    if (error instanceof AdminRefundRejectionError) {
      return jsonResponse(
        { success: false, code: error.code, message: error.message },
        error.status,
      );
    }

    console.error(
      "[ADMIN_REFUND_REJECT_ERROR]",
      error instanceof Error ? { name: error.name, message: error.message } : error,
    );

    return jsonResponse(
      { success: false, code: "REFUND_REJECTION_FAILED", message: "Impossible de refuser cette demande de remboursement pour le moment." },
      500,
    );
  }
}
