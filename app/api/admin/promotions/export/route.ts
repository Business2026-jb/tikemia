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
  exportPromotionsPdf,
} from "@/lib/admin/promotions/export-promotions-pdf";
import {
  requireAdmin,
} from "@/lib/admin/require-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

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
  })
  .strict();

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
): Promise<Response> {
  try {
    await requireAdmin();

    const parsed = querySchema.safeParse(
      queryObject(request),
    );

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "ADMIN_PROMOTION_EXPORT_FAILED",
            message:
              parsed.error.issues[0]?.message ??
              "Les paramètres d’export sont invalides.",
            details: {
              fields:
                parsed.error.flatten().fieldErrors,
            },
          },
        },
        {
          status: 422,
        },
      );
    }

    const result = await exportPromotionsPdf({
      search: parsed.data.search,
      status: parsed.data.status,
      source: parsed.data.source,
      organizerId: parsed.data.organizerId,
      country: parsed.data.country,
      startsFrom: parsed.data.startsFrom,
      startsTo: parsed.data.startsTo,
      sort: parsed.data.sort,
    });

    return new Response(
      Buffer.from(result.bytes),
      {
        status: 200,
        headers: {
          "Content-Type": result.mimeType,
          "Content-Disposition":
            `attachment; filename="${result.fileName}"`,
          "Content-Length":
            String(result.bytes.byteLength),
          "Cache-Control":
            "private, no-store, no-cache, must-revalidate, max-age=0",
          Pragma: "no-cache",
          Expires: "0",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch (error) {
    console.error(
      "[ADMIN_PROMOTIONS_EXPORT_ERROR]",
      error,
    );

    const serialized =
      serializeAdminPromotionError(error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: serialized.code,
          message: serialized.message,
          details: serialized.details ?? null,
        },
      },
      {
        status: serialized.status,
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  }
}
