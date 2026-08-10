import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  expireEndedPromotions,
} from "@/lib/promotions/expire-ended-promotions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

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

function isAuthorized(
  request: NextRequest,
): boolean {
  const configuredSecret =
    process.env.CRON_SECRET?.trim();

  if (!configuredSecret) {
    return false;
  }

  const authorization =
    request.headers.get("authorization");

  const headerSecret =
    request.headers.get("x-cron-secret");

  return (
    authorization ===
      `Bearer ${configuredSecret}` ||
    headerSecret ===
      configuredSecret
  );
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  if (!process.env.CRON_SECRET?.trim()) {
    return jsonResponse(
      {
        success: false,
        error: {
          code: "CRON_SECRET_MISSING",
          message:
            "CRON_SECRET n’est pas configurée.",
        },
      },
      500,
    );
  }

  if (!isAuthorized(request)) {
    return jsonResponse(
      {
        success: false,
        error: {
          code: "CRON_UNAUTHORIZED",
          message:
            "Cette exécution automatique n’est pas autorisée.",
        },
      },
      401,
    );
  }

  try {
    const data =
      await expireEndedPromotions({
        now: new Date(),
        batchSize: 500,
      });

    return jsonResponse({
      success: true,
      message:
        "Les statuts des promotions ont été synchronisés.",
      data,
    });
  } catch (error) {
    console.error(
      "[PROMOTIONS_CRON_EXPIRE_ERROR]",
      error,
    );

    return jsonResponse(
      {
        success: false,
        error: {
          code:
            "PROMOTIONS_CRON_EXPIRE_FAILED",
          message:
            "Impossible de synchroniser les promotions.",
        },
      },
      500,
    );
  }
}
