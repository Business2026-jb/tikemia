import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { serializeAdminMarketingError } from "@/lib/admin/marketing/admin-marketing-errors";
import { exportMarketingPdf } from "@/lib/admin/marketing/export-marketing-pdf";
import { requireAdmin } from "@/lib/admin/require-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

const querySchema = z.object({
  search: z
    .string()
    .trim()
    .max(200)
    .optional(),

  status: z
    .enum([
      "all",
      "DRAFT",
      "SCHEDULED",
      "ACTIVE",
      "PAUSED",
      "COMPLETED",
      "ARCHIVED",
    ])
    .default("all"),

  channel: z
  .enum([
    "all",
    "DIRECT",
    "FACEBOOK",
    "INSTAGRAM",
    "TIKTOK",
    "WHATSAPP",
    "EMAIL",
    "GOOGLE",
    "TELEGRAM",
    "LINKEDIN",
    "INFLUENCER",
    "PARTNER",
    "AFFILIATE",
    "QR_CODE",
    "OTHER",
  ])
  .default("all"),

  organizerId: z
    .string()
    .trim()
    .max(200)
    .optional(),

  eventId: z
    .string()
    .trim()
    .max(200)
    .optional(),

  country: z
    .string()
    .trim()
    .max(120)
    .optional(),

  startsFrom: z
    .string()
    .trim()
    .max(64)
    .optional(),

  startsTo: z
    .string()
    .trim()
    .max(64)
    .optional(),

  sort: z
    .enum([
      "recent",
      "oldest",
      "budget_desc",
      "budget_asc",
      "visits_desc",
      "orders_desc",
      "revenue_desc",
      "ending_soon",
    ])
    .default("recent"),
});

export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  try {
    await requireAdmin();

    const parsed =
      querySchema.safeParse(
        Object.fromEntries(
          request.nextUrl.searchParams.entries(),
        ),
      );

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,

          error: {
            code:
              "ADMIN_MARKETING_EXPORT_FAILED",

            message:
              parsed.error
                .issues[0]
                ?.message ||
              "Les paramètres d’export sont invalides.",

            details: {
              fields:
                parsed.error
                  .flatten()
                  .fieldErrors,
            },
          },
        },
        {
          status: 422,

          headers: {
            "Cache-Control":
              "private, no-store",

            "X-Content-Type-Options":
              "nosniff",
          },
        },
      );
    }

    const result =
      await exportMarketingPdf({
        search:
          parsed.data.search ||
          null,

        status:
          parsed.data.status,

        channel:
          parsed.data.channel,

        organizerId:
          parsed.data.organizerId ||
          null,

        eventId:
          parsed.data.eventId ||
          null,

        country:
          parsed.data.country ||
          null,

        startsFrom:
          parsed.data.startsFrom ||
          null,

        startsTo:
          parsed.data.startsTo ||
          null,

        sort:
          parsed.data.sort,
      });

    return new NextResponse(
      result.bytes,
      {
        status: 200,

        headers: {
          "Content-Type":
            result.mimeType,

          "Content-Disposition":
            `attachment; filename="${result.fileName}"`,

          "Content-Length":
            String(
              result.bytes.byteLength,
            ),

          "Cache-Control":
            "private, no-store, max-age=0",

          "X-Content-Type-Options":
            "nosniff",
        },
      },
    );
  } catch (error) {
    console.error(
      "[ADMIN_MARKETING_EXPORT_ERROR]",
      error,
    );

    const serialized =
      serializeAdminMarketingError(
        error,
      );

    return NextResponse.json(
      {
        success: false,

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
            "private, no-store",

          "X-Content-Type-Options":
            "nosniff",
        },
      },
    );
  }
}