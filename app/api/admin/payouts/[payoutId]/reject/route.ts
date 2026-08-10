import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  z,
} from "zod";

import {
  serializeAdminPayoutError,
} from "@/lib/admin/payouts/admin-payout-errors";
import {
  rejectAdminPayout,
} from "@/lib/admin/payouts/reject-admin-payout";
import {
  requireAdmin,
} from "@/lib/admin/require-admin";
import {
  sendPayoutRejectedEmail,
} from "@/lib/mail/payouts/send-payout-rejected-email";

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
    params: Promise<{
      payoutId: string;
    }>;
  }>;

const requestSchema =
  z.object({
    reason:
      z.string()
        .trim()
        .min(
          5,
          "Le motif du refus doit contenir au moins 5 caractères.",
        )
        .max(
          2_000,
          "Le motif du refus est trop long.",
        ),

    adminNote:
      z.string()
        .trim()
        .max(
          4_000,
          "La note administrative est trop longue.",
        )
        .nullable()
        .optional(),

    supportMessage:
      z.string()
        .trim()
        .max(
          1_000,
          "Le message d’accompagnement est trop long.",
        )
        .nullable()
        .optional(),
  })
    .strict();

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

        "X-Frame-Options":
          "SAMEORIGIN",

        "Referrer-Policy":
          "no-referrer",
      },
    },
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

export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const adminSession =
      await requireAdmin();

    const {
      payoutId,
    } =
      await context.params;

    const normalizedPayoutId =
      decodeURIComponent(
        payoutId,
      ).trim();

    const body =
      await readJsonBody(
        request,
      );

    if (body === null) {
      return jsonResponse(
        {
          success:
            false,

          error: {
            code:
              "ADMIN_PAYOUT_ACTION_NOT_ALLOWED",

            message:
              "Le corps JSON de la requête est invalide.",

            details:
              null,
          },
        },
        400,
      );
    }

    const parsed =
      requestSchema.safeParse(
        body,
      );

    if (!parsed.success) {
      return jsonResponse(
        {
          success:
            false,

          error: {
            code:
              "ADMIN_PAYOUT_ACTION_NOT_ALLOWED",

            message:
              parsed.error
                .issues[0]
                ?.message ??
              "Les informations de refus sont invalides.",

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
      await rejectAdminPayout({
        payoutId:
          normalizedPayoutId,

        adminId:
          adminSession.admin.id,

        reason:
          parsed.data.reason,

        adminNote:
          parsed.data.adminNote,
      });

    let emailSent =
      false;

    let emailError:
      string | null =
      null;

    try {
      await sendPayoutRejectedEmail({
        to:
          result.organizerEmail,

        organizerName:
          result.organizerName,

        payoutId:
          result.payoutId,

        reference:
          result.reference,

        amount:
          result.amount,

        currency:
          result.currency,

        reason:
          result.rejectionReason,

        processedAt:
          result.processedAt,

        supportMessage:
          parsed.data.supportMessage,
      });

      emailSent =
        true;
    } catch (mailError) {
      emailError =
        mailError instanceof Error
          ? mailError.message
          : "L’e-mail de notification n’a pas pu être envoyé.";

      console.error(
        "[ADMIN_PAYOUT_REJECTED_EMAIL_ERROR]",
        mailError,
      );
    }

    return jsonResponse({
      success:
        true,

      message:
        emailSent
          ? "Le retrait a été refusé et l’organisateur a été notifié."
          : "Le retrait a été refusé, mais l’e-mail de notification n’a pas pu être envoyé.",

      data:
        result,

      notification: {
        emailSent,
        error:
          emailError,
      },
    });
  } catch (error) {
    console.error(
      "[ADMIN_PAYOUT_REJECT_ERROR]",
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
      serializeAdminPayoutError(
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
