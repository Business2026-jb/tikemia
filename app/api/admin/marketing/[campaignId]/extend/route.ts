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

import { extendAdminMarketingCampaign } from "@/lib/admin/marketing/extend-admin-marketing-campaign";
import { sendMarketingExtendedEmail } from "@/lib/mail/marketing/send-marketing-extended-email";

const schema = z
  .object({
    additionalDays: z.coerce.number().int().min(1).max(3650),
    reactivateIfCompleted: z.boolean().default(true),
  })
  .strict();

export async function POST(
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
            code: "ADMIN_MARKETING_PERIOD_INVALID",
            message:
              parsed.error.issues[0]?.message ||
              "La durée de prolongation est invalide.",
            details: {
              fields: parsed.error.flatten().fieldErrors,
            },
          },
        },
        422,
      );
    }

    const result = await extendAdminMarketingCampaign({
      campaignId: decodeURIComponent(campaignId).trim(),
      adminId: adminSession.admin.id,
      additionalDays: parsed.data.additionalDays,
      reactivateIfCompleted: parsed.data.reactivateIfCompleted,
      ipAddress: getClientIpAddress(request),
      userAgent: normalizeText(request.headers.get("user-agent")),
    });

    let emailSent = false;

    try {
      await sendMarketingExtendedEmail({
        to: result.organizerEmail,
        organizerName: result.organizerName,
        campaignId: result.campaignId,
        campaignName: result.campaignName,
        eventTitle: result.eventTitle,
        previousEndsAt: result.previousEndsAt,
        newEndsAt: result.endsAt,
        additionalDays: result.additionalDays,
        reactivated: result.reactivated,
      });

      emailSent = true;
    } catch (emailError) {
      console.error("[MARKETING_EXTENDED_EMAIL_ERROR]", emailError);
    }

    return jsonResponse({
      success: true,
      message: "La campagne marketing a été prolongée.",
      data: {
        ...result,
        emailSent,
      },
    });
  } catch (error) {
    console.error("[ADMIN_MARKETING_EXTEND_ERROR]", error);

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
