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
  getAdminSubscriptions,
} from "@/lib/admin/subscriptions/get-admin-subscriptions";
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
          "La recherche est trop longue.",
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
          "L’identifiant du plan est trop long.",
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
          "La devise est invalide.",
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
          "La date est invalide.",
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

    page:
      z.coerce
        .number()
        .int()
        .min(
          1,
          "La page doit être supérieure ou égale à 1.",
        )
        .max(
          100_000,
          "La page demandée est trop élevée.",
        )
        .optional(),

    pageSize:
      z.coerce
        .number()
        .int()
        .min(
          1,
          "La taille de page doit être supérieure ou égale à 1.",
        )
        .max(
          100,
          "La taille de page ne peut pas dépasser 100.",
        )
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

        "X-Frame-Options":
          "SAMEORIGIN",

        "Referrer-Policy":
          "no-referrer",
      },
    },
  );
}

function searchParamsToObject(
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
        searchParamsToObject(
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
              "Les paramètres de recherche sont invalides.",

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
      await getAdminSubscriptions({
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

        page:
          parsed.data.page,

        pageSize:
          parsed.data.pageSize,
      });

    return jsonResponse({
      success:
        true,

      data,
    });
  } catch (error) {
    console.error(
      "[ADMIN_SUBSCRIPTIONS_LIST_ERROR]",
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
