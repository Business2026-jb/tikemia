import {
  NextResponse,
} from "next/server";

import {
  requireClient,
} from "@/lib/client/auth/require-client";
import {
  getClientRefunds,
} from "@/lib/client/refunds/get-client-refunds";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

export const maxDuration =
  30;

const REFUND_REQUESTS_ENABLED =
  false;

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
          "no-store, no-cache, must-revalidate, max-age=0",
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

export async function GET():
  Promise<NextResponse> {
  const {
    customer,
  } =
    await requireClient(
      "/account/refunds",
    );

  try {
    const refunds =
      await getClientRefunds({
        customer: {
          id:
            customer.id,
          email:
            customer.email,
        },
        limit:
          200,
      });

    return jsonResponse({
      success:
        true,
      data: {
        refunds,
        total:
          refunds.length,
        refundRequestsEnabled:
          REFUND_REQUESTS_ENABLED,
      },
    });
  } catch (error) {
    console.error(
      "[CLIENT_REFUNDS_GET_ERROR]",
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

    return jsonResponse(
      {
        success:
          false,
        error: {
          code:
            "CLIENT_REFUNDS_LOAD_FAILED",
          message:
            "Impossible de charger vos demandes de remboursement pour le moment.",
        },
      },
      500,
    );
  }
}

export async function POST():
  Promise<NextResponse> {
  await requireClient(
    "/account/refunds",
  );

  if (
    !REFUND_REQUESTS_ENABLED
  ) {
    return jsonResponse(
      {
        success:
          false,
        error: {
          code:
            "REFUND_REQUESTS_DISABLED",
          message:
            "Les nouvelles demandes de remboursement sont temporairement indisponibles.",
        },
      },
      503,
    );
  }

  return jsonResponse(
    {
      success:
        false,
      error: {
        code:
          "REFUND_REQUESTS_DISABLED",
        message:
          "Les nouvelles demandes de remboursement sont temporairement indisponibles.",
      },
    },
    503,
  );
}