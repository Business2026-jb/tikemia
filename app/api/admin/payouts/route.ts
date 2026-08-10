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
  getAdminPayouts,
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
    !Number.isInteger(
      parsed,
    ) ||
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
  };
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  try {
    await requireAdmin();

    const result =
      await getAdminPayouts(
        buildInput(
          request,
        ),
      );

    return jsonResponse({
      success:
        true,

      data:
        result,
    });
  } catch (error) {
    console.error(
      "[ADMIN_PAYOUTS_GET_ERROR]",
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
