import { createHash } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  updateOrganizerSettings,
  UpdateOrganizerSettingsError,
  type UpdateOrganizerSettingsInput,
} from "@/lib/organizer/update-organizer-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SESSION_COOKIE_FALLBACK_NAME =
  "tikemia_session";

type UpdateOrganizerSettingsRequestBody = Omit<
  UpdateOrganizerSettingsInput,
  "organizerId"
>;

type UpdateOrganizerSettingsApiResponse = {
  success: boolean;
  message: string;
  code?: string;
  fields?: Record<string, string[]>;

  data?: {
    settings: {
      preferences: {
        language: string;
        currency: string;
        timezone: string;
        dateFormat: string;
        theme: string;
      };

      notifications: {
        emailNotifications: boolean;
        whatsappNotifications: boolean;
        dashboardNotifications: boolean;

        notifyTicketSales: boolean;
        notifyPayments: boolean;
        notifyRefunds: boolean;
        notifyEventStatus: boolean;
        notifySecurity: boolean;
      };

      ticketing: {
        maxTicketsPerOrder: number;
        showRemainingTickets: boolean;
        allowTicketTransfer: boolean;
        allowRefundRequests: boolean;
      };

      metadata: {
        settingsId: string;
        updatedAt: string;
      };
    };
  };
};

type AuthenticatedOrganizer = {
  id: string;
};

function jsonResponse(
  body: UpdateOrganizerSettingsApiResponse,
  status: number,
): NextResponse<UpdateOrganizerSettingsApiResponse> {
  return NextResponse.json(body, {
    status,

    headers: {
      "Cache-Control":
        "no-store, max-age=0, must-revalidate",

      Pragma: "no-cache",
      Expires: "0",

      "X-Content-Type-Options":
        "nosniff",
    },
  });
}

function hashSessionToken(
  token: string,
): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

function hasJsonContentType(
  request: Request,
): boolean {
  const contentType =
    request.headers
      .get("content-type")
      ?.toLowerCase() ?? "";

  return contentType.includes(
    "application/json",
  );
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

async function parseRequestBody(
  request: Request,
): Promise<UpdateOrganizerSettingsRequestBody | null> {
  try {
    const body: unknown =
      await request.json();

    if (!isRecord(body)) {
      return null;
    }

    return body as UpdateOrganizerSettingsRequestBody;
  } catch {
    return null;
  }
}

async function getAuthenticatedOrganizer(): Promise<AuthenticatedOrganizer | null> {
  const cookieStore =
    await cookies();

  const sessionCookieName =
    process.env
      .SESSION_COOKIE_NAME
      ?.trim() ||
    SESSION_COOKIE_FALLBACK_NAME;

  const sessionToken =
    cookieStore.get(
      sessionCookieName,
    )?.value;

  if (!sessionToken) {
    return null;
  }

  const session =
    await prisma.session.findUnique({
      where: {
        tokenHash:
          hashSessionToken(
            sessionToken,
          ),
      },

      select: {
        id: true,
        expiresAt: true,

        user: {
          select: {
            id: true,
            role: true,
            emailVerified: true,
            isActive: true,
          },
        },
      },
    });

  if (!session) {
    return null;
  }

  if (
    session.expiresAt.getTime() <=
    Date.now()
  ) {
    await prisma.session
      .delete({
        where: {
          id: session.id,
        },
      })
      .catch(
        (error: unknown) => {
          console.error(
            "[UPDATE_SETTINGS_EXPIRED_SESSION_DELETE_ERROR]",
            error instanceof Error
              ? error.message
              : error,
          );
        },
      );

    return null;
  }

  if (
    session.user.role !==
      "ORGANIZER" ||
    !session.user.emailVerified ||
    !session.user.isActive
  ) {
    return null;
  }

  return {
    id: session.user.id,
  };
}

export async function PATCH(
  request: Request,
): Promise<
  NextResponse<UpdateOrganizerSettingsApiResponse>
> {
  try {
    if (
      !hasJsonContentType(
        request,
      )
    ) {
      return jsonResponse(
        {
          success: false,

          code:
            "UNSUPPORTED_CONTENT_TYPE",

          message:
            "Les paramètres doivent être envoyés au format JSON.",
        },
        415,
      );
    }

    const organizer =
      await getAuthenticatedOrganizer();

    if (!organizer) {
      return jsonResponse(
        {
          success: false,

          code: "UNAUTHORIZED",

          message:
            "Votre session est absente, invalide ou expirée.",
        },
        401,
      );
    }

    const body =
      await parseRequestBody(
        request,
      );

    if (!body) {
      return jsonResponse(
        {
          success: false,

          code:
            "INVALID_JSON_BODY",

          message:
            "Les paramètres envoyés sont invalides ou illisibles.",
        },
        400,
      );
    }

    const result =
      await updateOrganizerSettings({
        ...body,

        organizerId:
          organizer.id,
      });

    return jsonResponse(
      {
        success: true,

        code:
          "ORGANIZER_SETTINGS_UPDATED",

        message:
          result.message,

        data: {
          settings:
            result.settings,
        },
      },
      200,
    );
  } catch (error) {
    if (
      error instanceof
      UpdateOrganizerSettingsError
    ) {
      console.warn(
        "[UPDATE_ORGANIZER_SETTINGS_REJECTED]",
        {
          code: error.code,
          status: error.status,
          message:
            error.message,
        },
      );

      return jsonResponse(
        {
          success: false,

          code:
            error.code,

          message:
            error.message,

          fields:
            error.fields,
        },
        error.status,
      );
    }

    console.error(
      "[UPDATE_ORGANIZER_SETTINGS_ROUTE_ERROR]",
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

    return jsonResponse(
      {
        success: false,

        code:
          "UPDATE_ORGANIZER_SETTINGS_FAILED",

        message:
          "Impossible de mettre à jour vos paramètres pour le moment.",
      },
      500,
    );
  }
}

export async function PUT(
  request: Request,
): Promise<
  NextResponse<UpdateOrganizerSettingsApiResponse>
> {
  return PATCH(request);
}