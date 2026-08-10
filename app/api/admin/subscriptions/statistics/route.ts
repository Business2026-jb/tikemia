import {
  SubscriptionBillingPeriod,
  SubscriptionStatus,
} from "@prisma/client";
import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  z,
} from "zod";

import {
  serializeAdminSubscriptionError,
} from "@/lib/admin/subscriptions/admin-subscription-errors";
import {
  getAdminSubscriptionStatistics,
} from "@/lib/admin/subscriptions/get-admin-subscription-statistics";
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

const querySchema =
  z.object({
    search:
      z.string()
        .trim()
        .max(
          200,
        )
        .optional(),

    status:
      z.union([
        z.literal(
          "all",
        ),
        z.nativeEnum(
          SubscriptionStatus,
        ),
      ])
        .optional(),

    planId:
      z.string()
        .trim()
        .max(
          191,
        )
        .optional(),

    billingPeriod:
      z.union([
        z.literal(
          "all",
        ),
        z.nativeEnum(
          SubscriptionBillingPeriod,
        ),
      ])
        .optional(),

    currency:
      z.string()
        .trim()
        .max(
          12,
        )
        .optional(),

    autoRenew:
      z.union([
        z.literal(
          "true",
        ),
        z.literal(
          "false",
        ),
      ])
        .optional(),

    endingBefore:
      z.string()
        .trim()
        .max(
          64,
        )
        .optional(),

    sort:
      z.enum([
        "recent",
        "oldest",
        "ending_soon",
        "price_desc",
        "price_asc",
      ])
        .optional(),
  })
    .strict();

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

function getQueryObject(
  request:
    NextRequest,
): Record<string, string> {
  const result:
    Record<string, string> =
    {};

  request.nextUrl.searchParams.forEach(
    (
      value,
      key,
    ) => {
      result[key] =
        value;
    },
  );

  return result;
}

export async function GET(
  request:
    NextRequest,
): Promise<NextResponse> {
  try {
    await requireAdmin();

    const parsed =
      querySchema.safeParse(
        getQueryObject(
          request,
        ),
      );

    if (!parsed.success) {
      return jsonResponse(
        {
          success:
            false,

          error: {
            code:
              "ADMIN_SUBSCRIPTION_QUERY_FAILED",

            message:
              parsed.error
                .issues[0]
                ?.message ??
              "Les filtres statistiques sont invalides.",

            details: {
              fields:
                parsed.error
                  .flatten()
                  .fieldErrors,
            },
          },
        },
        422,
      );
    }

    const data =
      await getAdminSubscriptionStatistics({
        search:
          parsed.data.search,

        status:
          parsed.data.status,

        planId:
          parsed.data.planId,

        billingPeriod:
          parsed.data.billingPeriod,

        currency:
          parsed.data.currency,

        autoRenew:
          parsed.data.autoRenew ===
          undefined
            ? null
            : parsed.data.autoRenew ===
              "true",

        endingBefore:
          parsed.data.endingBefore,

        sort:
          parsed.data.sort,
      });

    return jsonResponse({
      success:
        true,

      data,
    });
  } catch (error) {
    console.error(
      "[ADMIN_SUBSCRIPTION_STATISTICS_ERROR]",
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
