import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  serializeAdminCustomerError,
} from "@/lib/admin/customers/customer-errors";
import {
  getAdminCustomer,
} from "@/lib/admin/customers/get-admin-customer";
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
      customerId: string;
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

export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    await requireAdmin();

    const {
      customerId,
    } =
      await context.params;

    const decodedCustomerId =
      decodeURIComponent(
        customerId,
      ).trim();

    const customer =
      await getAdminCustomer(
        decodedCustomerId,
      );

    return jsonResponse({
      success:
        true,

      data:
        customer,
    });
  } catch (error) {
    console.error(
      "[ADMIN_CUSTOMER_GET_ERROR]",
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
      serializeAdminCustomerError(
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
