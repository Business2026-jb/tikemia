import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  serializeAdminPayoutError,
} from "@/lib/admin/payouts/admin-payout-errors";
import {
  getAdminPayout,
} from "@/lib/admin/payouts/get-admin-payout";
import {
  requireAdmin,
} from "@/lib/admin/require-admin";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

type RouteContext =
  Readonly<{
    params: Promise<{
      payoutId: string;
    }>;
  }>;

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

        "X-Frame-Options":
          "SAMEORIGIN",

        "Referrer-Policy":
          "no-referrer",
      },
    },
  );
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    await requireAdmin();

    const {
      payoutId,
    } =
      await context.params;

    const normalizedPayoutId =
      decodeURIComponent(
        payoutId,
      ).trim();

    const payout =
      await getAdminPayout(
        normalizedPayoutId,
      );

    return jsonResponse({
      success:
        true,

      data:
        payout,
    });
  } catch (error) {
    console.error(
      "[ADMIN_PAYOUT_GET_ERROR]",
      error instanceof Error
        ? {
            name:
              error.name,

            message:
              error.message,

            stack:
              process.env.NODE_ENV ===
              "development"
                ? error.stack
                : undefined,
          }
        : error,
    );

    const serialized =
      serializeAdminPayoutError(
        error,
      );

    return jsonResponse(
      {
        success:
          false,

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
