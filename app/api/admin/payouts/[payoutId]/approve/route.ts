import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  z,
} from "zod";

import {
  approveAdminPayout,
} from "@/lib/admin/payouts/approve-admin-payout";
import {
  serializeAdminPayoutError,
} from "@/lib/admin/payouts/admin-payout-errors";
import {
  requireAdmin,
} from "@/lib/admin/require-admin";
import {
  sendPayoutApprovedEmail,
} from "@/lib/mail/payouts/send-payout-approved-email";

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
    adminNote:
      z.string()
        .trim()
        .max(
          4_000,
          "La note administrative est trop longue.",
        )
        .nullable()
        .optional(),

    estimatedDelay:
      z.string()
        .trim()
        .max(
          500,
          "Le délai estimé est trop long.",
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
              "Les informations d’approbation sont invalides.",

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
      await approveAdminPayout({
        payoutId:
          normalizedPayoutId,

        adminId:
          adminSession.admin.id,

        adminNote:
          parsed.data.adminNote,
      });

    let emailSent =
      false;

    let emailError:
      string | null =
      null;

    try {
      await sendPayoutApprovedEmail({
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

        fee:
          result.fee,

        netAmount:
          result.netAmount,

        currency:
          result.currency,

        destinationType:
          result.destinationType,

        processedAt:
          result.processedAt,

        estimatedDelay:
          parsed.data.estimatedDelay,
      });

      emailSent =
        true;
    } catch (mailError) {
      emailError =
        mailError instanceof Error
          ? mailError.message
          : "L’e-mail de notification n’a pas pu être envoyé.";

      console.error(
        "[ADMIN_PAYOUT_APPROVED_EMAIL_ERROR]",
        mailError,
      );
    }

    return jsonResponse({
      success:
        true,

      message:
        emailSent
          ? "Le retrait a été approuvé et l’organisateur a été notifié."
          : "Le retrait a été approuvé, mais l’e-mail de notification n’a pas pu être envoyé.",

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
      "[ADMIN_PAYOUT_APPROVE_ERROR]",
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
