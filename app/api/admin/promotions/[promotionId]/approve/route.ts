import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  z,
} from "zod";

import {
  approveAdminPromotion,
} from "@/lib/admin/promotions/approve-admin-promotion";
import {
  serializeAdminPromotionError,
} from "@/lib/admin/promotions/admin-promotion-errors";
import {
  requireAdmin,
} from "@/lib/admin/require-admin";
import {
  sendPromotionApprovedEmail,
} from "@/lib/mail/promotions/send-promotion-approved-email";

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
    startsAt:
      z.string().trim().max(64).nullable().optional(),
    endsAt:
      z.string().trim().max(64).nullable().optional(),
    priorityScore:
      z.number().int().min(0).max(10_000).nullable().optional(),
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

    const body =
      await readJsonBody(request);

    if (body === null) {
      return jsonResponse(
        {
          success: false,
          error: {
            code: "ADMIN_PROMOTION_ACTION_NOT_ALLOWED",
            message:
              "Le corps JSON de la requête est invalide.",
          },
        },
        400,
      );
    }

    const parsed =
      bodySchema.safeParse(body);

    if (!parsed.success) {
      return jsonResponse(
        {
          success: false,
          error: {
            code: "ADMIN_PROMOTION_ACTION_NOT_ALLOWED",
            message:
              parsed.error.issues[0]?.message ??
              "Les informations de validation sont invalides.",
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
  await approveAdminPromotion({
    promotionId:
      decodeURIComponent(
        promotionId,
      ).trim(),

    adminId:
      adminSession.admin.id,

    startsAt:
      parsed.data.startsAt,

    endsAt:
      parsed.data.endsAt,

    priorityScore:
      parsed.data.priorityScore,

    ipAddress:
      getClientIpAddress(request),

    userAgent:
      normalizeOptional(
        request.headers.get(
          "user-agent",
        ),
      ),
  });

    const emailSent =
      await sendEmailSafely(
        () =>
          sendPromotionApprovedEmail({
            to: result.organizerEmail,
            organizerName:
              result.organizerName,
            eventTitle:
              result.eventTitle,
            promotionId:
              result.promotionId,
            startsAt:
              result.startsAt,
            endsAt:
              result.endsAt,
            priority:
              result.priorityScore,
          }),
        "[PROMOTION_APPROVED_EMAIL_ERROR]",
      );

    return jsonResponse({
      success: true,
      message: emailSent
        ? "La promotion a été validée et l’organisateur a été notifié."
        : "La promotion a été validée, mais l’e-mail n’a pas pu être envoyé.",
      data: {
        ...result,
        emailSent,
      },
    });
  } catch (error) {
    console.error(
      "[ADMIN_PROMOTION_APPROVE_ERROR]",
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
