import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { activateAdminCoupon } from "@/lib/admin/coupons/activate-admin-coupon";
import { serializeAdminCouponError } from "@/lib/admin/coupons/admin-coupon-errors";
import { requireAdmin } from "@/lib/admin/require-admin";
import { sendCouponActivatedEmail } from "@/lib/mail/coupons/send-coupon-activated-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

type RouteContext = Readonly<{
  params: Promise<{
    couponId: string;
  }>;
}>;

function normalizeText(
  value: string | null | undefined,
): string | null {
  const normalized =
    value
      ?.replace(/\s+/g, " ")
      .trim() ?? "";

  return normalized || null;
}

function getClientIpAddress(
  request: Request,
): string | null {
  const forwardedFor =
    normalizeText(
      request.headers.get(
        "x-forwarded-for",
      ),
    );

  if (forwardedFor) {
    return (
      forwardedFor
        .split(",")[0]
        ?.trim() ||
      null
    );
  }

  return (
    normalizeText(
      request.headers.get(
        "x-real-ip",
      ),
    ) ||
    normalizeText(
      request.headers.get(
        "cf-connecting-ip",
      ),
    ) ||
    null
  );
}

async function readJsonBody(
  request: Request,
): Promise<unknown> {
  const contentType =
    request.headers.get(
      "content-type",
    ) ?? "";

  if (
    !contentType
      .toLowerCase()
      .includes(
        "application/json",
      )
  ) {
    return {};
  }

  try {
    return await request.json();
  } catch {
    return null;
  }
}

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
      },
    },
  );
}

const schema = z
  .object({
    startsAt: z
      .string()
      .trim()
      .max(64)
      .nullable()
      .optional(),

    expiresAt: z
      .string()
      .trim()
      .max(64)
      .nullable()
      .optional(),
  })
  .strict();

export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const adminSession =
      await requireAdmin();

    const {
      couponId,
    } =
      await context.params;

    const normalizedCouponId =
      decodeURIComponent(
        couponId,
      ).trim();

    if (!normalizedCouponId) {
      return jsonResponse(
        {
          success: false,

          error: {
            code:
              "ADMIN_COUPON_INVALID_ID",

            message:
              "L’identifiant du code promo est invalide.",
          },
        },
        400,
      );
    }

    const body =
      await readJsonBody(
        request,
      );

    if (body === null) {
      return jsonResponse(
        {
          success: false,

          error: {
            code:
              "ADMIN_COUPON_ACTION_NOT_ALLOWED",

            message:
              "Le corps JSON de la requête est invalide.",
          },
        },
        400,
      );
    }

    const parsed =
      schema.safeParse(
        body,
      );

    if (!parsed.success) {
      return jsonResponse(
        {
          success: false,

          error: {
            code:
              "ADMIN_COUPON_ACTION_NOT_ALLOWED",

            message:
              parsed.error
                .issues[0]
                ?.message ||
              "Les informations d’activation sont invalides.",

            details:
              parsed.error
                .flatten()
                .fieldErrors,
          },
        },
        422,
      );
    }

    const result =
      await activateAdminCoupon({
        couponId:
          normalizedCouponId,

        /*
         * requireAdmin() retourne adminSession.admin,
         * pas adminSession.user.
         */
        adminId:
          adminSession.admin.id,

        startsAt:
          parsed.data.startsAt,

        expiresAt:
          parsed.data.expiresAt,

        ipAddress:
          getClientIpAddress(
            request,
          ),

        userAgent:
          normalizeText(
            request.headers.get(
              "user-agent",
            ),
          ),
      });

    let emailSent =
      false;

    try {
      await sendCouponActivatedEmail({
        to:
          result.organizerEmail,

        organizerName:
          result.organizerName,

        couponId:
          result.couponId,

        code:
          result.code,

        eventTitle:
          result.eventTitle,

        startsAt:
          result.startsAt,

        expiresAt:
          result.expiresAt,
      });

      emailSent =
        true;
    } catch (
      emailError
    ) {
      console.error(
        "[ADMIN_COUPON_ACTIVATED_EMAIL_ERROR]",
        emailError,
      );
    }

    return jsonResponse({
      success: true,

      message:
        "Le code promo a été activé.",

      data: {
        ...result,
        emailSent,
      },
    });
  } catch (error) {
    console.error(
      "[ADMIN_COUPON_ACTIVATE_ERROR]",
      error,
    );

    const serialized =
      serializeAdminCouponError(
        error,
      );

    return jsonResponse(
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
      serialized.status,
    );
  }
}