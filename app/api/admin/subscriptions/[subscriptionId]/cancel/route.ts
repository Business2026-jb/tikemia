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
  cancelAdminSubscription,
} from "@/lib/admin/subscriptions/cancel-admin-subscription";
import {
  requireAdmin,
} from "@/lib/admin/require-admin";
import {
  sendSubscriptionCancelledEmail,
} from "@/lib/mail/subscriptions/send-subscription-cancelled-email";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

export const maxDuration =
  30;

type RouteContext =
  Readonly<{
    params:
      Promise<{
        subscriptionId:
          string;
      }>;
  }>;

const bodySchema =
  z.object({
    reason:
      z.string()
        .trim()
        .min(
          5,
          "Le motif doit contenir au moins 5 caractères.",
        )
        .max(
          2_000,
          "Le motif est trop long.",
        ),

    disableAutoRenew:
      z.boolean()
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

async function readJsonBody(
  request:
    Request,
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

async function sendEmailSafely(
  operation:
    () => Promise<unknown>,
  label:
    string,
): Promise<boolean> {
  try {
    await operation();

    return true;
  } catch (error) {
    console.error(
      label,
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

    return false;
  }
}

export async function POST(
  request:
    NextRequest,
  context:
    RouteContext,
): Promise<NextResponse> {
  try {
    const adminSession =
      await requireAdmin();

    const {
      subscriptionId,
    } =
      await context.params;

    const body =
      await readJsonBody(
        request,
      );

    const parsed =
      bodySchema.safeParse(
        body,
      );

    if (!parsed.success) {
      return jsonResponse(
        {
          success:
            false,

          error: {
            code:
              "ADMIN_SUBSCRIPTION_REASON_REQUIRED",

            message:
              parsed.error
                .issues[0]
                ?.message ??
              "Les informations d’annulation sont invalides.",

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

    const result =
      await cancelAdminSubscription({
        subscriptionId:
          decodeURIComponent(
            subscriptionId,
          ).trim(),

        adminId:
          adminSession.admin.id,

        reason:
          parsed.data.reason,

        disableAutoRenew:
          parsed.data.disableAutoRenew,
      });

    const emailSent =
      await sendEmailSafely(
        () =>
          sendSubscriptionCancelledEmail({
            to:
              result.organizerEmail,

            organizerName:
              result.organizerName,

            subscriptionId:
              result.subscriptionId,

            planName:
              result.plan.name,

            reason:
              result.reason,

            cancelledAt:
              result.canceledAt,
          }),

        "[ADMIN_SUBSCRIPTION_CANCELLED_EMAIL_ERROR]",
      );

    return jsonResponse({
      success:
        true,

      message:
        emailSent
          ? "L’abonnement a été annulé et l’organisateur a été notifié."
          : "L’abonnement a été annulé, mais l’e-mail n’a pas pu être envoyé.",

      data: {
        ...result,
        emailSent,
      },
    });
  } catch (error) {
    console.error(
      "[ADMIN_SUBSCRIPTION_CANCEL_ERROR]",
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
