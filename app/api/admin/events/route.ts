import {
  EventStatus,
} from "@prisma/client";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  serializeAdminEventError,
} from "@/lib/admin/events/admin-event-errors";
import {
  getAdminEvents,
  type AdminEventSort,
} from "@/lib/admin/events/get-admin-events";
import {
  requireAdmin,
} from "@/lib/admin/require-admin";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

const ALLOWED_SORTS =
  new Set<AdminEventSort>([
    "recent",
    "oldest",
    "starts_soon",
    "starts_later",
    "most_sales",
    "highest_revenue",
    "title_asc",
    "title_desc",
  ]);

const EVENT_STATUSES =
  new Set<string>(
    Object.values(
      EventStatus,
    ),
  );

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
): EventStatus | "all" {
  if (
    !value ||
    value ===
      "all"
  ) {
    return "all";
  }

  return EVENT_STATUSES.has(
    value,
  )
    ? (value as EventStatus)
    : "all";
}

function parseSort(
  value: string | null,
): AdminEventSort {
  if (
    value &&
    ALLOWED_SORTS.has(
      value as AdminEventSort,
    )
  ) {
    return value as AdminEventSort;
  }

  return "recent";
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  try {
    await requireAdmin();

    const searchParams =
      request.nextUrl
        .searchParams;

    const result =
      await getAdminEvents({
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

        country:
          searchParams.get(
            "country",
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
      "[ADMIN_EVENTS_GET_ERROR]",
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
      serializeAdminEventError(
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
