import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  serializeAdminPaymentError,
} from "@/lib/admin/payments/admin-payment-errors";
import {
  getAdminPayment,
} from "@/lib/admin/payments/get-admin-payment";
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
      paymentId: string;
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
      paymentId,
    } =
      await context.params;

    const normalizedPaymentId =
      decodeURIComponent(
        paymentId,
      ).trim();

    const payment =
      await getAdminPayment(
        normalizedPaymentId,
      );

    return jsonResponse({
      success:
        true,

      data:
        payment,
    });
  } catch (error) {
    console.error(
      "[ADMIN_PAYMENT_GET_ERROR]",
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
      serializeAdminPaymentError(
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
