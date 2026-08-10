import {
  NextResponse,
} from "next/server";

import {
  serializeAdminSubscriptionError,
} from "@/lib/admin/subscriptions/admin-subscription-errors";
import {
  getAdminSubscription,
} from "@/lib/admin/subscriptions/get-admin-subscription";
import {
  requireAdmin,
} from "@/lib/admin/require-admin";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

export const maxDuration =
  30;

type RouteContext =
  Readonly<{
    params:
      Promise<{
        subscriptionId:
          string;
      }>;
  }>;

function jsonResponse(
  body:
    Record<
      string,
      unknown
    >,
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

export async function GET(
  _request:
    Request,
  context:
    RouteContext,
): Promise<NextResponse> {
  try {
    await requireAdmin();

    const {
      subscriptionId,
    } =
      await context.params;

    const normalizedSubscriptionId =
      decodeURIComponent(
        subscriptionId,
      ).trim();

    const data =
      await getAdminSubscription(
        normalizedSubscriptionId,
      );

    return jsonResponse({
      success:
        true,

      data,
    });
  } catch (error) {
    console.error(
      "[ADMIN_SUBSCRIPTION_DETAIL_ERROR]",
      error,
    );

    const serialized =
      serializeAdminSubscriptionError(
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
