import { createHash } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  updateEvent,
  UpdateEventError,
  type UpdateEventInput,
} from "@/lib/events/update-event";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SESSION_COOKIE_FALLBACK_NAME =
  "tikemia_session";

type UpdateOrganizerEventRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type UpdateEventRequestBody = Omit<
  UpdateEventInput,
  "eventId" | "organizerId"
>;

type UpdateEventResponse = {
  success: boolean;
  message: string;
  code?: string;
  fields?: Record<string, string[]>;
  redirectTo?: string;
  data?: {
    event: {
      id: string;
      title: string;
      slug: string;
      status: string;
      coverImage: string;
      capacity: number;
      updatedAt: string;
    };
  };
};

type AuthenticatedOrganizer = {
  id: string;
};

function jsonResponse(
  body: UpdateEventResponse,
  status: number,
): NextResponse<UpdateEventResponse> {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control":
        "no-store, max-age=0, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "X-Content-Type-Options": "nosniff",
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

function normalizeEventId(
  value: string,
): string {
  return value.trim();
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

async function getAuthenticatedOrganizer(): Promise<AuthenticatedOrganizer | null> {
  const cookieStore = await cookies();

  const sessionCookieName =
    process.env.SESSION_COOKIE_NAME?.trim() ||
    SESSION_COOKIE_FALLBACK_NAME;

  const sessionToken =
    cookieStore.get(
      sessionCookieName,
    )?.value;

  if (!sessionToken) {
    return null;
  }

  const tokenHash =
    hashSessionToken(sessionToken);

  const session =
    await prisma.session.findUnique({
      where: {
        tokenHash,
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
      .catch((error: unknown) => {
        console.error(
          "[UPDATE_EVENT_EXPIRED_SESSION_DELETE_ERROR]",
          error instanceof Error
            ? error.message
            : error,
        );
      });

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

async function parseRequestBody(
  request: Request,
): Promise<
  UpdateEventRequestBody | null
> {
  try {
    const body: unknown =
      await request.json();

    if (!isRecord(body)) {
      return null;
    }

    return body as UpdateEventRequestBody;
  } catch {
    return null;
  }
}

async function handleUpdateRequest(
  request: Request,
  context: UpdateOrganizerEventRouteContext,
): Promise<
  NextResponse<UpdateEventResponse>
> {
  try {
    if (!hasJsonContentType(request)) {
      return jsonResponse(
        {
          success: false,
          code:
            "UNSUPPORTED_CONTENT_TYPE",
          message:
            "Les informations doivent être envoyées au format JSON.",
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

    const { id: rawEventId } =
      await context.params;

    const eventId =
      normalizeEventId(rawEventId);

    if (!eventId) {
      return jsonResponse(
        {
          success: false,
          code: "INVALID_EVENT_ID",
          message:
            "L’identifiant de l’événement est invalide.",
        },
        400,
      );
    }

    const body =
      await parseRequestBody(request);

    if (!body) {
      return jsonResponse(
        {
          success: false,
          code: "INVALID_JSON_BODY",
          message:
            "Les informations envoyées sont invalides ou illisibles.",
        },
        400,
      );
    }

    /*
     * L’identifiant de l’événement et celui de
     * l’organisateur ne sont jamais acceptés depuis
     * le navigateur.
     *
     * Ils sont imposés par la route et par la session.
     */
    const result = await updateEvent({
      ...body,
      eventId,
      organizerId: organizer.id,
    });

    return jsonResponse(
      {
        success: true,
        code: "EVENT_UPDATED",
        message: result.message,
        redirectTo:
          result.redirectTo,

        data: {
          event: {
            id: result.event.id,
            title:
              result.event.title,
            slug:
              result.event.slug,
            status:
              result.event.status,
            coverImage:
              result.event.coverImage,
            capacity:
              result.event.capacity,
            updatedAt:
              result.event.updatedAt,
          },
        },
      },
      200,
    );
  } catch (error) {
    if (
      error instanceof UpdateEventError
    ) {
      console.warn(
        "[UPDATE_ORGANIZER_EVENT_REJECTED]",
        {
          code: error.code,
          status: error.status,
          message: error.message,
        },
      );

      return jsonResponse(
        {
          success: false,
          code: error.code,
          message: error.message,
          fields: error.fields,
        },
        error.status,
      );
    }

    console.error(
      "[UPDATE_ORGANIZER_EVENT_ROUTE_ERROR]",
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

    return jsonResponse(
      {
        success: false,
        code:
          "UPDATE_EVENT_FAILED",
        message:
          "Impossible de modifier l’événement pour le moment.",
      },
      500,
    );
  }
}

/*
 * PATCH est la méthode principale, car nous
 * modifions un événement existant.
 */
export async function PATCH(
  request: Request,
  context: UpdateOrganizerEventRouteContext,
): Promise<
  NextResponse<UpdateEventResponse>
> {
  return handleUpdateRequest(
    request,
    context,
  );
}

/*
 * PUT est également accepté pour éviter une
 * erreur si le futur formulaire utilise PUT.
 */
export async function PUT(
  request: Request,
  context: UpdateOrganizerEventRouteContext,
): Promise<
  NextResponse<UpdateEventResponse>
> {
  return handleUpdateRequest(
    request,
    context,
  );
}