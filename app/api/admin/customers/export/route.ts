import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  serializeAdminCustomerError,
} from "@/lib/admin/customers/customer-errors";
import {
  exportCustomersPdf,
} from "@/lib/admin/customers/export-customers-pdf";
import type {
  AdminCustomerSort,
  AdminCustomerStatusFilter,
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

export const maxDuration =
  60;

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

function jsonErrorResponse(
  body: Record<string, unknown>,
  status: number,
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

function sanitizeFileName(
  value: string,
): string {
  return value
    .replace(
      /[\r\n"]/g,
      "",
    )
    .replace(
      /[^a-zA-Z0-9._-]/g,
      "-",
    );
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  try {
    await requireAdmin();

    const searchParams =
      request.nextUrl.searchParams;

    const exported =
      await exportCustomersPdf({
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
      });

    const fileName =
      sanitizeFileName(
        exported.fileName,
      );

    return new NextResponse(
      new Uint8Array(
        exported.buffer,
      ),
      {
        status:
          200,

        headers: {
          "Content-Type":
            exported.mimeType,

          "Content-Disposition":
            `attachment; filename="${fileName}"`,

          "Content-Length":
            String(
              exported.buffer
                .byteLength,
            ),

          "Cache-Control":
            "private, no-store, no-cache, must-revalidate, max-age=0",

          Pragma:
            "no-cache",

          Expires:
            "0",

          "X-Content-Type-Options":
            "nosniff",

          "X-Tikemia-Customers-Count":
            String(
              exported.customersCount,
            ),
        },
      },
    );
  } catch (error) {
    console.error(
      "[ADMIN_CUSTOMERS_EXPORT_ERROR]",
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

    return jsonErrorResponse(
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
