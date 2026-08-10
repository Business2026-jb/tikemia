import {
  PaymentStatus,
} from "@prisma/client";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  serializeAdminPaymentError,
} from "@/lib/admin/payments/admin-payment-errors";
import {
  exportPaymentsPdf,
} from "@/lib/admin/payments/export-payments-pdf";
import {
  type AdminPaymentSort,
  type GetAdminPaymentsInput,
} from "@/lib/admin/payments/get-admin-payments";
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

const PAYMENT_STATUSES =
  new Set<string>(
    Object.values(
      PaymentStatus,
    ),
  );

const PAYMENT_SORTS =
  new Set<AdminPaymentSort>([
    "recent",
    "oldest",
    "amount_desc",
    "amount_asc",
  ]);

function parseStatus(
  value: string | null,
): PaymentStatus | "all" {
  if (
    !value ||
    value === "all"
  ) {
    return "all";
  }

  return PAYMENT_STATUSES.has(
    value,
  )
    ? (value as PaymentStatus)
    : "all";
}

function parseSort(
  value: string | null,
): AdminPaymentSort {
  if (
    value &&
    PAYMENT_SORTS.has(
      value as AdminPaymentSort,
    )
  ) {
    return value as AdminPaymentSort;
  }

  return "recent";
}

function buildInput(
  request: NextRequest,
): GetAdminPaymentsInput {
  const searchParams =
    request.nextUrl
      .searchParams;

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

    provider:
      searchParams.get(
        "provider",
      ),

    currency:
      searchParams.get(
        "currency",
      ),

    method:
      searchParams.get(
        "method",
      ) ??
      searchParams.get(
        "paymentMethod",
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
    "[ADMIN_PAYMENTS_EXPORT_ERROR]",
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
      await exportPaymentsPdf({
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
