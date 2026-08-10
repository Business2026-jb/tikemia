import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { approveAdminMarketingCampaign } from "@/lib/admin/marketing/approve-admin-marketing-campaign";
import { serializeAdminMarketingError } from "@/lib/admin/marketing/admin-marketing-errors";
import { requireAdmin } from "@/lib/admin/require-admin";
import { sendMarketingApprovedEmail } from "@/lib/mail/marketing/send-marketing-approved-email";

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
  const normalized =
    value
      ?.replace(/\s+/g, " ")
      .trim() ?? "";

  return normalized || null;
}

function getClientIpAddress(
  request: Request,
): string | null {
  const forwardedFor =
    normalizeText(
      request.headers.get(
        "x-forwarded-for",
      ),
    );

  if (forwardedFor) {
    return (
      forwardedFor
        .split(",")[0]
        ?.trim() ||
      null
    );
  }

  return (
    normalizeText(
      request.headers.get(
        "x-real-ip",
      ),
    ) ||
    normalizeText(
      request.headers.get(
        "cf-connecting-ip",
      ),
    ) ||
    null
  );
}

async function readJsonBody(
  request: Request,
): Promise<unknown> {
  const contentType =
    request.headers.get(
      "content-type",
    ) ?? "";

  if (
    !contentType
      .toLowerCase()
      .includes(
        "application/json",
      )
  ) {
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
  return NextResponse.json(
    body,
    {
      status,

      headers: {
        "Cache-Control":
          "private, no-store, no-cache, must-revalidate, max-age=0",

        Pragma:
          "no-cache",

        Expires:
          "0",

        "X-Content-Type-Options":
          "nosniff",
      },
    },
  );
}

const schema = z
  .object({
    startsAt: z
      .string()
      .trim()
      .max(64)
      .nullable()
      .optional(),

    endsAt: z
      .string()
      .trim()
      .max(64)
      .nullable()
      .optional(),

    note: z
      .string()
      .trim()
      .max(2000)
      .nullable()
      .optional(),
  })
  .strict();

export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const adminSession =
      await requireAdmin();

    const {
      campaignId,
    } =
      await context.params;

    const normalizedCampaignId =
      decodeURIComponent(
        campaignId,
      ).trim();

    if (!normalizedCampaignId) {
      return jsonResponse(
        {
          success: false,

          error: {
            code:
              "ADMIN_MARKETING_ACTION_INVALID",

            message:
              "L’identifiant de la campagne marketing est invalide.",
          },
        },
        400,
      );
    }

    const body =
      await readJsonBody(
        request,
      );

    if (body === null) {
      return jsonResponse(
        {
          success: false,

          error: {
            code:
              "ADMIN_MARKETING_ACTION_INVALID",

            message:
              "Le corps JSON de la requête est invalide.",
          },
        },
        400,
      );
    }

    const parsed =
      schema.safeParse(
        body,
      );

    if (!parsed.success) {
      return jsonResponse(
        {
          success: false,

          error: {
            code:
              "ADMIN_MARKETING_ACTION_INVALID",

            message:
              parsed.error
                .issues[0]
                ?.message ||
              "Les informations d’approbation sont invalides.",

            details: {
              fields:
                parsed.error
                  .flatten()
                  .fieldErrors,
            },
          },
        },
        422,
      );
    }

    const result =
      await approveAdminMarketingCampaign({
        campaignId:
          normalizedCampaignId,

        adminId:
          adminSession.admin.id,

        startsAt:
          parsed.data.startsAt,

        endsAt:
          parsed.data.endsAt,

        note:
          parsed.data.note,

        ipAddress:
          getClientIpAddress(
            request,
          ),

        userAgent:
          normalizeText(
            request.headers.get(
              "user-agent",
            ),
          ),
      });

    let emailSent =
      false;

    try {
      await sendMarketingApprovedEmail({
        to:
          result.organizerEmail,

        organizerName:
          result.organizerName,

        campaignId:
          result.campaignId,

        campaignName:
          result.campaignName,

        eventTitle:
          result.eventTitle,

        startsAt:
          result.startsAt,

        endsAt:
          result.endsAt,
      });

      emailSent =
        true;
    } catch (emailError) {
      console.error(
        "[MARKETING_APPROVED_EMAIL_ERROR]",
        emailError,
      );
    }

    return jsonResponse({
      success: true,

      message:
        "La campagne marketing a été approuvée.",

      data: {
        ...result,
        emailSent,
      },
    });
  } catch (error) {
    console.error(
      "[ADMIN_MARKETING_APPROVE_ERROR]",
      error,
    );

    const serialized =
      serializeAdminMarketingError(
        error,
      );

    return jsonResponse(
      {
        success: false,

        error: {
          code:
            serialized.code,

          message:
            serialized.message,

          details:
            serialized.details ??
            null,
        },
      },
      serialized.status,
    );
  }
}