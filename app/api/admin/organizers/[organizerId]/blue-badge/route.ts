import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  z,
} from "zod";

import {
  requireAdmin,
} from "@/lib/admin/require-admin";
import {
  UpdateOrganizerBlueBadgeError,
  updateOrganizerBlueBadge,
} from "@/lib/admin/organizers/update-organizer-blue-badge";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

export const maxDuration =
  30;

type RouteContext = Readonly<{
  params: Promise<{
    organizerId: string;
  }>;
}>;

const bodySchema = z
  .object({
    action: z.enum([
      "GRANT",
      "REVOKE",
    ]),

    reason: z
      .string()
      .trim()
      .max(
        2000,
        "Le motif est trop long.",
      )
      .nullable()
      .optional(),
  })
  .strict();

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string | null {
  const normalized =
    value
      ?.replace(
        /\s+/g,
        " ",
      )
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
  body: Record<
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

export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const adminSession =
      await requireAdmin();

    const {
      organizerId,
    } =
      await context.params;

    const normalizedOrganizerId =
      decodeURIComponent(
        organizerId,
      ).trim();

    if (!normalizedOrganizerId) {
      return jsonResponse(
        {
          success:
            false,

          error: {
            code:
              "ORGANIZER_ID_REQUIRED",

            message:
              "L’identifiant de l’organisateur est obligatoire.",
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
          success:
            false,

          error: {
            code:
              "ORGANIZER_BLUE_BADGE_BODY_INVALID",

            message:
              "Le corps JSON de la requête est invalide.",
          },
        },
        400,
      );
    }

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
              "ORGANIZER_BLUE_BADGE_ACTION_INVALID",

            message:
              parsed.error
                .issues[0]
                ?.message ??
              "Les informations du badge bleu sont invalides.",

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
      await updateOrganizerBlueBadge({
        organizerId:
          normalizedOrganizerId,

        adminId:
          adminSession.admin.id,

        action:
          parsed.data.action,

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

    const message =
      result.action ===
      "GRANT"
        ? result.changed
          ? "Le badge bleu Tikemia a été attribué à cet organisateur."
          : "Cet organisateur possède déjà le badge bleu Tikemia."
        : result.changed
          ? "Le badge bleu Tikemia a été retiré de cet organisateur."
          : "Cet organisateur ne possède déjà plus le badge bleu Tikemia.";

    return jsonResponse({
      success:
        true,

      message,

      data: {
        organizerId:
          result.organizerId,

        organizerName:
          result.organizerName,

        organizerEmail:
          result.organizerEmail,

        hasBlueBadge:
          result.hasBlueBadge,

        blueBadgeGrantedAt:
          result.blueBadgeGrantedAt,

        action:
          result.action,

        changed:
          result.changed,
      },
    });
  } catch (error) {
    console.error(
      "[ADMIN_ORGANIZER_BLUE_BADGE_ERROR]",
      error instanceof Error
        ? {
            name:
              error.name,

            message:
              error.message,

            stack:
              process.env
                .NODE_ENV ===
              "development"
                ? error.stack
                : undefined,
          }
        : error,
    );

    if (
      error instanceof
      UpdateOrganizerBlueBadgeError
    ) {
      return jsonResponse(
        {
          success:
            false,

          error: {
            code:
              error.code,

            message:
              error.message,

            details:
              error.details ??
              null,
          },
        },
        error.status,
      );
    }

    return jsonResponse(
      {
        success:
          false,

        error: {
          code:
            "ADMIN_ORGANIZER_BLUE_BADGE_FAILED",

          message:
            "Impossible de modifier le badge bleu de cet organisateur pour le moment.",
        },
      },
      500,
    );
  }
}