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
  requestPayoutInformation,
} from "@/lib/admin/payouts/request-payout-information";
import {
  requireAdmin,
} from "@/lib/admin/require-admin";
import {
  sendPayoutInformationRequestedEmail,
} from "@/lib/mail/payouts/send-payout-information-requested-email";

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
    message:
      z.string()
        .trim()
        .min(
          10,
          "Le message doit contenir au moins 10 caractères.",
        )
        .max(
          2_000,
          "Le message est trop long.",
        ),

    requestedFields:
      z.array(
        z.string()
          .trim()
          .min(
            1,
            "Un champ demandé est invalide.",
          )
          .max(
            100,
            "Un champ demandé est trop long.",
          ),
      )
        .max(
          20,
          "Vous ne pouvez pas demander plus de 20 éléments.",
        )
        .optional(),

    responseUrl:
      z.string()
        .trim()
        .url(
          "Le lien de réponse est invalide.",
        )
        .max(
          2_000,
          "Le lien de réponse est trop long.",
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
              "ADMIN_PAYOUT_INFORMATION_REQUIRED",

            message:
              parsed.error
                .issues[0]
                ?.message ??
              "La demande d’informations est invalide.",

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
      await requestPayoutInformation({
        payoutId:
          normalizedPayoutId,

        adminId:
          adminSession.admin.id,

        message:
          parsed.data.message,

        requestedFields:
          parsed.data.requestedFields,
      });

    let emailSent =
      false;

    let emailError:
      string | null =
      null;

    try {
      await sendPayoutInformationRequestedEmail({
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

        message:
          result.message,

        requestedFields:
          result.requestedFields,

        requestedAt:
          result.requestedAt,

        responseUrl:
          parsed.data.responseUrl,
      });

      emailSent =
        true;
    } catch (mailError) {
      emailError =
        mailError instanceof Error
          ? mailError.message
          : "L’e-mail de notification n’a pas pu être envoyé.";

      console.error(
        "[ADMIN_PAYOUT_INFORMATION_EMAIL_ERROR]",
        mailError,
      );
    }

    return jsonResponse({
      success:
        true,

      message:
        emailSent
          ? "La demande d’informations a été enregistrée et envoyée à l’organisateur."
          : "La demande d’informations a été enregistrée, mais l’e-mail n’a pas pu être envoyé.",

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
      "[ADMIN_PAYOUT_INFORMATION_REQUEST_ERROR]",
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
