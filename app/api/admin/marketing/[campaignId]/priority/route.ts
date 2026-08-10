import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { serializeAdminMarketingError } from "@/lib/admin/marketing/admin-marketing-errors";
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

function normalizeText(
  value: string | null | undefined,
): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim() ?? "";
  return normalized || null;
}

function getClientIpAddress(
  request: Request,
): string | null {
  const forwardedFor = normalizeText(
    request.headers.get("x-forwarded-for"),
  );

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  return (
    normalizeText(request.headers.get("x-real-ip")) ||
    normalizeText(request.headers.get("cf-connecting-ip")) ||
    null
  );
}

async function readJsonBody(
  request: Request,
): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("application/json")) {
    return {};
  }

  try {
    return await request.json();
  } catch {
    return null;
  }
}

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

import { updateAdminMarketingPriority } from "@/lib/admin/marketing/update-admin-marketing-priority";
import { sendMarketingPriorityUpdatedEmail } from "@/lib/mail/marketing/send-marketing-priority-updated-email";

const schema = z
  .object({
    priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]),
    reason: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const adminSession = await requireAdmin();
    const { campaignId } = await context.params;
    const body = await readJsonBody(request);

    if (body === null) {
      return jsonResponse(
        {
          success: false,
          error: {
            code: "ADMIN_MARKETING_ACTION_INVALID",
            message: "Le corps JSON de la requête est invalide.",
          },
        },
        400,
      );
    }

    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return jsonResponse(
        {
          success: false,
          error: {
            code: "ADMIN_MARKETING_PRIORITY_INVALID",
            message:
              parsed.error.issues[0]?.message ||
              "La priorité marketing est invalide.",
            details: {
              fields: parsed.error.flatten().fieldErrors,
            },
          },
        },
        422,
      );
    }

    const result = await updateAdminMarketingPriority({
      campaignId: decodeURIComponent(campaignId).trim(),
      adminId: adminSession.admin.id,
      priority: parsed.data.priority,
      reason: parsed.data.reason,
      ipAddress: getClientIpAddress(request),
      userAgent: normalizeText(request.headers.get("user-agent")),
    });

    let emailSent = false;

    try {
      await sendMarketingPriorityUpdatedEmail({
        to: result.organizerEmail,
        organizerName: result.organizerName,
        campaignId: result.campaignId,
        campaignName: result.campaignName,
        eventTitle: result.eventTitle,
        previousPriority: result.previousPriority,
        newPriority: result.priority,
        reason: parsed.data.reason,
      });

      emailSent = true;
    } catch (emailError) {
      console.error("[MARKETING_PRIORITY_EMAIL_ERROR]", emailError);
    }

    return jsonResponse({
      success: true,
      message: "La priorité marketing a été mise à jour.",
      data: {
        ...result,
        emailSent,
      },
    });
  } catch (error) {
    console.error("[ADMIN_MARKETING_PRIORITY_ERROR]", error);

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
