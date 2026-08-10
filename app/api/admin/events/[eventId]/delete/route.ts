import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  z,
} from "zod";

import {
  serializeAdminEventError,
} from "@/lib/admin/events/admin-event-errors";
import {
  deleteAdminEvent,
} from "@/lib/admin/events/delete-admin-event";
import {
  requireAdmin,
} from "@/lib/admin/require-admin";

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
      eventId: string;
    }>;
  }>;

const deleteSchema =
  z.object({
    confirmationTitle:
      z.string()
        .trim()
        .min(
          1,
          "Le titre de confirmation est obligatoire.",
        )
        .max(
          300,
          "Le titre de confirmation est trop long.",
        ),

    reason:
      z.string()
        .trim()
        .max(
          2_000,
          "Le motif est trop long.",
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

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string | null {
  const normalized =
    value?.trim() ?? "";

  return normalized ||
    null;
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
        .split(
          ",",
        )[0]
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

export async function DELETE(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const adminSession =
      await requireAdmin();

    const {
      eventId,
    } =
      await context.params;

    const normalizedEventId =
      decodeURIComponent(
        eventId,
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
              "ADMIN_EVENT_DELETE_NOT_ALLOWED",

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
      deleteSchema.safeParse(
        body,
      );

    if (!parsed.success) {
      return jsonResponse(
        {
          success:
            false,

          error: {
            code:
              "ADMIN_EVENT_DELETE_NOT_ALLOWED",

            message:
              parsed.error
                .issues[0]
                ?.message ??
              "Les informations de suppression sont invalides.",

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
      await deleteAdminEvent({
        eventId:
          normalizedEventId,

        adminId:
          adminSession.admin.id,

        confirmationTitle:
          parsed.data
            .confirmationTitle,

        reason:
          parsed.data.reason,

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

    return jsonResponse({
      success:
        true,

      message:
        "L’événement a été supprimé définitivement.",

      data:
        result,
    });
  } catch (error) {
    console.error(
      "[ADMIN_EVENT_DELETE_ERROR]",
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
      serializeAdminEventError(
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