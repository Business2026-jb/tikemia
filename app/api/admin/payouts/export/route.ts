import {
  PayoutDestinationType,
  PayoutStatus,
} from "@prisma/client";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  serializeAdminPayoutError,
} from "@/lib/admin/payouts/admin-payout-errors";
import {
  exportPayoutsPdf,
} from "@/lib/admin/payouts/export-payouts-pdf";
import {
  type AdminPayoutSort,
  type GetAdminPayoutsInput,
} from "@/lib/admin/payouts/get-admin-payouts";
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

const PAYOUT_STATUSES =
  new Set<string>(
    Object.values(
      PayoutStatus,
    ),
  );

const DESTINATION_TYPES =
  new Set<string>(
    Object.values(
      PayoutDestinationType,
    ),
  );

const PAYOUT_SORTS =
  new Set<AdminPayoutSort>([
    "recent",
    "oldest",
    "amount_desc",
    "amount_asc",
  ]);

function parseStatus(
  value: string | null,
): PayoutStatus | "all" {
  if (
    !value ||
    value === "all"
  ) {
    return "all";
  }

  return PAYOUT_STATUSES.has(
    value,
  )
    ? (value as PayoutStatus)
    : "all";
}

function parseDestinationType(
  value: string | null,
): PayoutDestinationType | "all" {
  if (
    !value ||
    value === "all"
  ) {
    return "all";
  }

  return DESTINATION_TYPES.has(
    value,
  )
    ? (value as PayoutDestinationType)
    : "all";
}

function parseSort(
  value: string | null,
): AdminPayoutSort {
  if (
    value &&
    PAYOUT_SORTS.has(
      value as AdminPayoutSort,
    )
  ) {
    return value as AdminPayoutSort;
  }

  return "recent";
}

function buildInput(
  request: NextRequest,
): GetAdminPayoutsInput {
  const searchParams =
    request.nextUrl.searchParams;

  return {
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

    destinationType:
      parseDestinationType(
        searchParams.get(
          "destinationType",
        ) ??
          searchParams.get(
            "method",
          ),
      ),

    currency:
      searchParams.get(
        "currency",
      ),

    dateFrom:
      searchParams.get(
        "dateFrom",
      ),

    dateTo:
      searchParams.get(
        "dateTo",
      ),

    sort:
      parseSort(
        searchParams.get(
          "sort",
        ),
      ),
  };
}

function errorResponse(
  error: unknown,
): NextResponse {
  console.error(
    "[ADMIN_PAYOUTS_EXPORT_ERROR]",
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

  return NextResponse.json(
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
    {
      status:
        serialized.status,

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
  request: NextRequest,
): Promise<NextResponse> {
  try {
    await requireAdmin();

    const report =
      await exportPayoutsPdf({
        ...buildInput(
          request,
        ),

        generatedAt:
          new Date(),
      });

    const body =
      Buffer.from(
        report.bytes,
      );

    return new NextResponse(
      body,
      {
        status:
          200,

        headers: {
          "Content-Type":
            report.mimeType,

          "Content-Disposition":
            `attachment; filename="${report.fileName}"`,

          "Content-Length":
            String(
              body.byteLength,
            ),

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
  } catch (error) {
    return errorResponse(
      error,
    );
  }
}
