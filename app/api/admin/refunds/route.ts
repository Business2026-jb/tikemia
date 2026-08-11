import { RefundStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin/require-admin";
import {
  getAdminRefunds,
  type AdminRefundWorkflowStage,
} from "@/lib/admin/refunds/get-admin-refunds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 300;

const WORKFLOW_STAGES = [
  "ORGANIZER_REVIEW",
  "ORGANIZER_REJECTED",
  "FORWARDED_TO_ADMIN",
  "ADMIN_REVIEW",
  "ADMIN_REJECTED",
  "REFUND_PROCESSING",
  "REFUNDED",
  "REFUND_FAILED",
  "CANCELLED",
  "UNKNOWN",
] as const satisfies readonly AdminRefundWorkflowStage[];

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


function normalizeSearch(value: string | null): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim().slice(0, 200) ?? "";
  return normalized || null;
}

function parseLimit(value: string | null): number {
  if (!value) return DEFAULT_LIMIT;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

function parseStatus(
  value: string | null,
): RefundStatus | "ALL" | null {
  if (!value) return "ALL";
  const normalized = value.trim().toUpperCase();
  if (normalized === "ALL") return "ALL";
  return Object.values(RefundStatus).includes(normalized as RefundStatus)
    ? (normalized as RefundStatus)
    : null;
}

function parseWorkflowStage(
  value: string | null,
): AdminRefundWorkflowStage | "ALL" | null {
  if (!value) return "ALL";
  const normalized = value.trim().toUpperCase();
  if (normalized === "ALL") return "ALL";
  return WORKFLOW_STAGES.includes(normalized as AdminRefundWorkflowStage)
    ? (normalized as AdminRefundWorkflowStage)
    : null;
}

export async function GET(
  request: NextRequest,
): Promise<Response> {
  try {
    await requireRefundAdmin();

    const searchParams = request.nextUrl.searchParams;
    const rawStatus = searchParams.get("status");
    const rawWorkflowStage =
      searchParams.get("workflowStage") ?? searchParams.get("stage");

    const status = parseStatus(rawStatus);
    const workflowStage = parseWorkflowStage(rawWorkflowStage);

    if (rawStatus && status === null) {
      return jsonResponse(
        {
          success: false,
          code: "INVALID_REFUND_STATUS",
          message: "Le statut de remboursement demandé n’est pas valide.",
        },
        400,
      );
    }

    if (rawWorkflowStage && workflowStage === null) {
      return jsonResponse(
        {
          success: false,
          code: "INVALID_WORKFLOW_STAGE",
          message: "L’étape de traitement demandée n’est pas valide.",
        },
        400,
      );
    }

    const search = normalizeSearch(
      searchParams.get("search") ?? searchParams.get("q"),
    );

    const refunds = await getAdminRefunds({
      filters: {
        status: status ?? "ALL",
        workflowStage: workflowStage ?? "ALL",
        search,
        limit: parseLimit(searchParams.get("limit")),
      },
    });

    return jsonResponse({
      success: true,
      data: {
        refunds,
        total: refunds.length,
        filters: {
          status: status ?? "ALL",
          workflowStage: workflowStage ?? "ALL",
          search,
        },
      },
    });
  } catch (error) {
    console.error(
      "[ADMIN_REFUNDS_GET_ERROR]",
      error instanceof Error
        ? { name: error.name, message: error.message }
        : error,
    );

    return jsonResponse(
      {
        success: false,
        code: "ADMIN_REFUNDS_LOAD_FAILED",
        message: "Impossible de charger les demandes de remboursement pour le moment.",
      },
      500,
    );
  }
}
