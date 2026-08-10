import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  serializeAdminCustomerError,
} from "@/lib/admin/customers/customer-errors";
import {
  getAdminCustomers,
  type AdminCustomerSort,
  type AdminCustomerStatusFilter,
} from "@/lib/admin/customers/get-admin-customers";
import {
  requireAdmin,
} from "@/lib/admin/require-admin";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

const ALLOWED_STATUSES =
  new Set<AdminCustomerStatusFilter>([
    "all",
    "registered",
    "guest",
    "active",
    "inactive",
    "verified",
    "unverified",
  ]);

const ALLOWED_SORTS =
  new Set<AdminCustomerSort>([
    "recent_purchase",
    "oldest_purchase",
    "most_orders",
    "most_tickets",
    "highest_spend",
    "name_asc",
    "name_desc",
  ]);

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

function parsePositiveInteger(
  value: string | null,
  fallback: number,
  maximum: number,
): number {
  if (!value) {
    return fallback;
  }

  const parsed =
    Number.parseInt(
      value,
      10,
    );

  if (
    !Number.isInteger(parsed) ||
    parsed <= 0
  ) {
    return fallback;
  }

  return Math.min(
    parsed,
    maximum,
  );
}

function parseStatus(
  value: string | null,
): AdminCustomerStatusFilter {
  if (
    value &&
    ALLOWED_STATUSES.has(
      value as AdminCustomerStatusFilter,
    )
  ) {
    return value as AdminCustomerStatusFilter;
  }

  return "all";
}

function parseSort(
  value: string | null,
): AdminCustomerSort {
  if (
    value &&
    ALLOWED_SORTS.has(
      value as AdminCustomerSort,
    )
  ) {
    return value as AdminCustomerSort;
  }

  return "recent_purchase";
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  try {
    await requireAdmin();

    const searchParams =
      request.nextUrl.searchParams;

    const result =
      await getAdminCustomers({
        search:
          searchParams.get(
            "search",
          ),

        status:
          parseStatus(
            searchParams.get(
              "status",
            ),
          ),

        sort:
          parseSort(
            searchParams.get(
              "sort",
            ),
          ),

        page:
          parsePositiveInteger(
            searchParams.get(
              "page",
            ),
            1,
            1_000_000,
          ),

        pageSize:
          parsePositiveInteger(
            searchParams.get(
              "pageSize",
            ),
            20,
            100,
          ),
      });

    return jsonResponse({
      success:
        true,

      data:
        result,
    });
  } catch (error) {
    console.error(
      "[ADMIN_CUSTOMERS_GET_ERROR]",
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
