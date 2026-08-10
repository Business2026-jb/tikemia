import {
  EventBoostSource,
  EventBoostStatus,
} from "@prisma/client";
import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  z,
} from "zod";

import {
  serializeAdminPromotionError,
} from "@/lib/admin/promotions/admin-promotion-errors";
import {
  getAdminPromotions,
} from "@/lib/admin/promotions/get-admin-promotions";
import {
  requireAdmin,
} from "@/lib/admin/require-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

const querySchema = z
  .object({
    search: z.string().trim().max(200).optional(),
    status: z
      .union([
        z.literal("all"),
        z.nativeEnum(EventBoostStatus),
      ])
      .optional(),
    source: z
      .union([
        z.literal("all"),
        z.nativeEnum(EventBoostSource),
      ])
      .optional(),
    organizerId: z.string().trim().max(191).optional(),
    country: z.string().trim().max(120).optional(),
    startsFrom: z.string().trim().max(64).optional(),
    startsTo: z.string().trim().max(64).optional(),
    sort: z
      .enum([
        "recent",
        "oldest",
        "starts_soon",
        "ends_soon",
        "priority_desc",
        "priority_asc",
      ])
      .optional(),
    page: z.coerce.number().int().min(1).max(100_000).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control":
        "private, no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function queryObject(
  request: NextRequest,
): Record<string, string> {
  const result: Record<string, string> = {};

  request.nextUrl.searchParams.forEach(
    (value, key) => {
      result[key] = value;
    },
  );

  return result;
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  try {
    await requireAdmin();

    const parsed = querySchema.safeParse(
      queryObject(request),
    );

    if (!parsed.success) {
      return jsonResponse(
        {
          success: false,
          error: {
            code: "ADMIN_PROMOTION_QUERY_FAILED",
            message:
              parsed.error.issues[0]?.message ??
              "Les paramètres de recherche sont invalides.",
            details: {
              fields:
                parsed.error.flatten().fieldErrors,
            },
          },
        },
        422,
      );
    }

    const data = await getAdminPromotions({
      search: parsed.data.search,
      status: parsed.data.status,
      source: parsed.data.source,
      organizerId: parsed.data.organizerId,
      country: parsed.data.country,
      startsFrom: parsed.data.startsFrom,
      startsTo: parsed.data.startsTo,
      sort: parsed.data.sort,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    });

    return jsonResponse({
      success: true,
      data,
    });
  } catch (error) {
    console.error(
      "[ADMIN_PROMOTIONS_LIST_ERROR]",
      error,
    );

    const serialized =
      serializeAdminPromotionError(error);

    return jsonResponse(
      {
        success: false,
        error: {
          code: serialized.code,
          message: serialized.message,
          details: serialized.details ?? null,
        },
      },
      serialized.status,
    );
  }
}
