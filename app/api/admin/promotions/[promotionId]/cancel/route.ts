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
  cancelAdminPromotion,
} from "@/lib/admin/promotions/cancel-admin-promotion";
import {
  requireAdmin,
} from "@/lib/admin/require-admin";
import {
  sendPromotionCancelledEmail,
} from "@/lib/mail/promotions/send-promotion-cancelled-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

type RouteContext = Readonly<{
  params: Promise<{
    promotionId: string;
  }>;
}>;

const bodySchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(
        5,
        "Le motif doit contenir au moins 5 caractères.",
      )
      .max(
        2_000,
        "Le motif est trop long.",
      ),
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
      "X-Frame-Options": "SAMEORIGIN",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function normalizeOptional(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

function getClientIpAddress(
  request: Request,
): string | null {
  const forwardedFor = normalizeOptional(
    request.headers.get("x-forwarded-for"),
  );

  if (forwardedFor) {
    return (
      forwardedFor.split(",")[0]?.trim() ||
      null
    );
  }

  return (
    normalizeOptional(
      request.headers.get("x-real-ip"),
    ) ||
    normalizeOptional(
      request.headers.get("cf-connecting-ip"),
    ) ||
    null
  );
}

async function readJsonBody(
  request: Request,
): Promise<unknown> {
  const contentType =
    request.headers.get("content-type") ?? "";

  if (
    !contentType
      .toLowerCase()
      .includes("application/json")
  ) {
    return {};
  }

  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function sendEmailSafely(
  operation: () => Promise<unknown>,
  errorLabel: string,
): Promise<boolean> {
  try {
    await operation();
    return true;
  } catch (error) {
    console.error(
      errorLabel,
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack:
              process.env.NODE_ENV ===
              "development"
                ? error.stack
                : undefined,
          }
        : error,
    );

    return false;
  }
}

export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const adminSession =
      await requireAdmin();

    const { promotionId } =
      await context.params;

    const parsed =
      bodySchema.safeParse(
        await readJsonBody(request),
      );

    if (!parsed.success) {
      return jsonResponse(
        {
          success: false,
          error: {
            code: "ADMIN_PROMOTION_REASON_REQUIRED",
            message:
              parsed.error.issues[0]?.message ??
              "Le motif d’annulation est invalide.",
            details: {
              fields:
                parsed.error.flatten().fieldErrors,
            },
          },
        },
        422,
      );
    }

    const result =
      await cancelAdminPromotion({
        promotionId:
          decodeURIComponent(
            promotionId,
          ).trim(),
        adminId:
          adminSession.admin.id,
        reason:
          parsed.data.reason,
        ipAddress:
          getClientIpAddress(request),
        userAgent:
          normalizeOptional(
            request.headers.get("user-agent"),
          ),
      });

    const emailSent =
      await sendEmailSafely(
        () =>
          sendPromotionCancelledEmail({
            to: result.organizerEmail,
            organizerName:
              result.organizerName,
            eventTitle:
              result.eventTitle,
            promotionId:
              result.promotionId,
            reason:
              result.reason,
          }),
        "[PROMOTION_CANCELLED_EMAIL_ERROR]",
      );

    return jsonResponse({
      success: true,
      message: emailSent
        ? "La promotion a été annulée et l’organisateur a été notifié."
        : "La promotion a été annulée, mais l’e-mail n’a pas pu être envoyé.",
      data: {
        ...result,
        emailSent,
      },
    });
  } catch (error) {
    console.error(
      "[ADMIN_PROMOTION_CANCEL_ERROR]",
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
