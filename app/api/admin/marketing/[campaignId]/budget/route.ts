import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { serializeAdminMarketingError } from "@/lib/admin/marketing/admin-marketing-errors";
import { updateAdminMarketingBudget } from "@/lib/admin/marketing/update-admin-marketing-budget";
import { requireAdmin } from "@/lib/admin/require-admin";
import { sendMarketingBudgetUpdatedEmail } from "@/lib/mail/marketing/send-marketing-budget-updated-email";

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
    budget: z
      .union([
        z
          .string()
          .trim()
          .max(50),

        z
          .number()
          .finite()
          .nonnegative(),
      ])
      .nullable(),

    reason: z
      .string()
      .trim()
      .max(2000)
      .nullable()
      .optional(),
  })
  .strict();

export async function PATCH(
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
              "ADMIN_MARKETING_BUDGET_INVALID",

            message:
              parsed.error
                .issues[0]
                ?.message ||
              "Le budget marketing est invalide.",

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
      await updateAdminMarketingBudget({
        campaignId:
          normalizedCampaignId,

        adminId:
          adminSession.admin.id,

        budget:
          parsed.data.budget,

        reason:
          parsed.data.reason,

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
      await sendMarketingBudgetUpdatedEmail({
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

        previousBudget:
          result.previousBudget,

        newBudget:
          result.budget,

        currency:
          result.currency,

        reason:
          parsed.data.reason,
      });

      emailSent =
        true;
    } catch (emailError) {
      console.error(
        "[MARKETING_BUDGET_EMAIL_ERROR]",
        emailError,
      );
    }

    return jsonResponse({
      success: true,

      message:
        "Le budget marketing a été mis à jour.",

      data: {
        ...result,
        emailSent,
      },
    });
  } catch (error) {
    console.error(
      "[ADMIN_MARKETING_BUDGET_ERROR]",
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