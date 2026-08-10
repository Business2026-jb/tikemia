import { timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { expireEndedMarketingCampaigns } from "@/lib/marketing/expire-ended-marketing-campaigns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

const querySchema = z.object({
  batchSize: z.coerce.number().int().min(1).max(1000).default(250),
});

function secureCompare(
  left: string,
  right: string,
): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function isAuthorized(request: NextRequest): boolean {
  const expectedSecret =
    process.env.CRON_SECRET?.trim() ||
    process.env.MARKETING_CRON_SECRET?.trim();

  if (!expectedSecret) {
    return process.env.NODE_ENV !== "production";
  }

  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const bearerToken = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";

  const headerSecret =
    request.headers.get("x-cron-secret")?.trim() ?? "";

  const suppliedSecret = bearerToken || headerSecret;

  return Boolean(
    suppliedSecret &&
      secureCompare(suppliedSecret, expectedSecret),
  );
}

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function execute(
  request: NextRequest,
): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return jsonResponse(
      {
        success: false,
        error: {
          code: "CRON_UNAUTHORIZED",
          message: "Accès non autorisé.",
        },
      },
      401,
    );
  }

  const parsed = querySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );

  if (!parsed.success) {
    return jsonResponse(
      {
        success: false,
        error: {
          code: "CRON_QUERY_INVALID",
          message:
            parsed.error.issues[0]?.message ||
            "Les paramètres du traitement sont invalides.",
        },
      },
      422,
    );
  }

  try {
    const result = await expireEndedMarketingCampaigns({
      batchSize: parsed.data.batchSize,
    });

    return jsonResponse({
      success: true,
      message:
        result.completed > 0
          ? `${result.completed} campagne(s) marketing terminée(s).`
          : "Aucune campagne marketing à terminer.",
      data: result,
    });
  } catch (error) {
    console.error("[MARKETING_EXPIRE_CRON_ERROR]", error);

    return jsonResponse(
      {
        success: false,
        error: {
          code: "MARKETING_EXPIRE_CRON_FAILED",
          message:
            "Impossible de terminer automatiquement les campagnes marketing.",
        },
      },
      500,
    );
  }
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  return execute(request);
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  return execute(request);
}
