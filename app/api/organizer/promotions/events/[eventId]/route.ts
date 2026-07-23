import { createHash } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import type {
  AssignPromotedEventInput,
  RemovePromotedEventInput,
  UpdatePromotedEventInput,
} from "@/lib/organizer/promotions/promotion-schemas";
import {
  assignPromotedEvent,
  removePromotedEvent,
  updatePromotedEvent,
  UpdatePromotedEventError,
  type UpdatedPromotedEvent,
} from "@/lib/organizer/promotions/update-promoted-event";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SESSION_COOKIE_FALLBACK_NAME =
  "tikemia_session";

type OrganizerPromotedEventRouteContext = {
  params: Promise<{
    eventId: string;
  }>;
};

type AuthenticatedOrganizer = {
  id: string;
};

type PromotionAction =
  | "PAUSE"
  | "RESUME"
  | "REMOVE"
  | "SCHEDULE"
  | "UPDATE";

type PromotionRouteSuccessResponse = {
  success: true;
  message: string;
  code:
    | "PROMOTION_CREATED"
    | "PROMOTION_UPDATED"
    | "PROMOTION_PAUSED"
    | "PROMOTION_RESUMED"
    | "PROMOTION_REMOVED";
  data: {
    boost: UpdatedPromotedEvent;
  };
};

type PromotionRouteErrorResponse = {
  success: false;
  message: string;
  code: string;
  fields?: Record<string, string[]>;
  redirectTo?: string;
};

type PromotionRouteResponse =
  | PromotionRouteSuccessResponse
  | PromotionRouteErrorResponse;

type PromotionRequestBody = {
  action?: unknown;
  boostId?: unknown;
  subscriptionId?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
  priorityScore?: unknown;
  source?: unknown;
  reason?: unknown;
  cancellationReason?: unknown;
};

function noStoreHeaders(): HeadersInit {
  return {
    "Cache-Control":
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "X-Content-Type-Options": "nosniff",
  };
}

function jsonResponse(
  body: PromotionRouteResponse,
  status: number,
): NextResponse<PromotionRouteResponse> {
  return NextResponse.json(body, {
    status,
    headers: noStoreHeaders(),
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

function normalizeEventId(
  value: string,
): string {
  return value.trim();
}

function normalizeAction(
  value: unknown,
): PromotionAction | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized =
    value.trim().toUpperCase();

  switch (normalized) {
    case "PAUSE":
    case "RESUME":
    case "REMOVE":
    case "SCHEDULE":
    case "UPDATE":
      return normalized;

    default:
      return null;
  }
}

async function parseJsonBody(
  request: Request,
): Promise<PromotionRequestBody | null> {
  try {
    const body: unknown =
      await request.json();

    return isRecord(body)
      ? (body as PromotionRequestBody)
      : null;
  } catch {
    return null;
  }
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
      .catch((error: unknown) => {
        console.error(
          "[PROMOTED_EVENT_ROUTE_EXPIRED_SESSION_DELETE_ERROR]",
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

function unauthorizedResponse() {
  return jsonResponse(
    {
      success: false,
      code: "UNAUTHORIZED",
      message:
        "Votre session est absente, invalide ou expirée.",
      redirectTo:
        "/organizer/login",
    },
    401,
  );
}

function unsupportedContentTypeResponse() {
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

function invalidJsonResponse() {
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

function invalidEventIdResponse() {
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

function handleKnownError(
  error: UpdatePromotedEventError,
  logContext: string,
) {
  console.warn(logContext, {
    code: error.code,
    status: error.status,
    message: error.message,
  });

  return jsonResponse(
    {
      success: false,
      code: error.code,
      message: error.message,
      fields: error.fields,
      redirectTo:
        error.redirectTo,
    },
    error.status,
  );
}

export async function POST(
  request: Request,
  context: OrganizerPromotedEventRouteContext,
): Promise<
  NextResponse<PromotionRouteResponse>
> {
  try {
    if (!hasJsonContentType(request)) {
      return unsupportedContentTypeResponse();
    }

    const organizer =
      await getAuthenticatedOrganizer();

    if (!organizer) {
      return unauthorizedResponse();
    }

    const { eventId: rawEventId } =
      await context.params;

    const eventId =
      normalizeEventId(rawEventId);

    if (!eventId) {
      return invalidEventIdResponse();
    }

    const body =
      await parseJsonBody(request);

    if (!body) {
      return invalidJsonResponse();
    }

    const input: AssignPromotedEventInput = {
      eventId,

      ...(typeof body.subscriptionId ===
      "string"
        ? {
            subscriptionId:
              body.subscriptionId.trim(),
          }
        : {}),

      ...(typeof body.startsAt ===
      "string"
        ? {
            startsAt: body.startsAt,
          }
        : {}),

      ...(typeof body.endsAt ===
      "string"
        ? {
            endsAt: body.endsAt,
          }
        : {}),

      ...(typeof body.priorityScore ===
      "number"
        ? {
            priorityScore:
              body.priorityScore,
          }
        : {}),

      ...(typeof body.source ===
      "string"
        ? {
            source: body.source,
          }
        : {}),
    } as AssignPromotedEventInput;

    const result =
      await assignPromotedEvent({
        organizerId: organizer.id,
        input,
      });

    return jsonResponse(
      {
        success: true,
        code: "PROMOTION_CREATED",
        message: result.message,
        data: {
          boost: result.boost,
        },
      },
      201,
    );
  } catch (error) {
    if (
      error instanceof
      UpdatePromotedEventError
    ) {
      return handleKnownError(
        error,
        "[ORGANIZER_PROMOTED_EVENT_CREATE_REJECTED]",
      );
    }

    console.error(
      "[ORGANIZER_PROMOTED_EVENT_CREATE_ERROR]",
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
          "CREATE_PROMOTION_FAILED",
        message:
          "Impossible de promouvoir cet événement pour le moment.",
      },
      500,
    );
  }
}

export async function PATCH(
  request: Request,
  context: OrganizerPromotedEventRouteContext,
): Promise<
  NextResponse<PromotionRouteResponse>
> {
  try {
    if (!hasJsonContentType(request)) {
      return unsupportedContentTypeResponse();
    }

    const organizer =
      await getAuthenticatedOrganizer();

    if (!organizer) {
      return unauthorizedResponse();
    }

    const { eventId: rawEventId } =
      await context.params;

    const eventId =
      normalizeEventId(rawEventId);

    if (!eventId) {
      return invalidEventIdResponse();
    }

    const body =
      await parseJsonBody(request);

    if (!body) {
      return invalidJsonResponse();
    }

    const action =
      normalizeAction(body.action);

    if (!action) {
      return jsonResponse(
        {
          success: false,
          code: "INVALID_ACTION",
          message:
            "L’action doit être PAUSE, RESUME, REMOVE, SCHEDULE ou UPDATE.",
        },
        400,
      );
    }

    const boostId =
      typeof body.boostId ===
        "string"
        ? body.boostId.trim()
        : "";

    if (
      action !== "REMOVE" &&
      !boostId
    ) {
      return jsonResponse(
        {
          success: false,
          code: "INVALID_BOOST_ID",
          message:
            "L’identifiant de la promotion est requis.",
        },
        400,
      );
    }

    if (action === "REMOVE") {
      const removeInput: RemovePromotedEventInput =
        {
          eventId,

          ...(boostId
            ? {
                boostId,
              }
            : {}),

          ...(typeof body.reason ===
          "string"
            ? {
                reason:
                  body.reason.trim(),
              }
            : {}),
        } as RemovePromotedEventInput;

      const result =
        await removePromotedEvent({
          organizerId: organizer.id,
          input: removeInput,
        });

      return jsonResponse(
        {
          success: true,
          code: "PROMOTION_REMOVED",
          message: result.message,
          data: {
            boost: result.boost,
          },
        },
        200,
      );
    }

    const status =
      action === "PAUSE"
        ? "PAUSED"
        : action === "RESUME"
          ? "ACTIVE"
          : action === "SCHEDULE"
            ? "SCHEDULED"
            : undefined;

    const updateInput: UpdatePromotedEventInput =
      {
        eventId,
        boostId,

        ...(status
          ? {
              status,
            }
          : {}),

        ...(typeof body.startsAt ===
        "string"
          ? {
              startsAt:
                body.startsAt,
            }
          : {}),

        ...(typeof body.endsAt ===
        "string"
          ? {
              endsAt:
                body.endsAt,
            }
          : {}),

        ...(typeof body.priorityScore ===
        "number"
          ? {
              priorityScore:
                body.priorityScore,
            }
          : {}),

        ...(typeof body
          .cancellationReason ===
        "string"
          ? {
              cancellationReason:
                body.cancellationReason.trim(),
            }
          : {}),
      } as UpdatePromotedEventInput;

    const result =
      await updatePromotedEvent({
        organizerId: organizer.id,
        input: updateInput,
      });

    const responseCode =
      action === "PAUSE"
        ? "PROMOTION_PAUSED"
        : action === "RESUME"
          ? "PROMOTION_RESUMED"
          : "PROMOTION_UPDATED";

    return jsonResponse(
      {
        success: true,
        code: responseCode,
        message: result.message,
        data: {
          boost: result.boost,
        },
      },
      200,
    );
  } catch (error) {
    if (
      error instanceof
      UpdatePromotedEventError
    ) {
      return handleKnownError(
        error,
        "[ORGANIZER_PROMOTED_EVENT_UPDATE_REJECTED]",
      );
    }

    console.error(
      "[ORGANIZER_PROMOTED_EVENT_UPDATE_ERROR]",
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
          "UPDATE_PROMOTION_FAILED",
        message:
          "Impossible de modifier cette promotion pour le moment.",
      },
      500,
    );
  }
}

export async function DELETE(
  request: Request,
  context: OrganizerPromotedEventRouteContext,
): Promise<
  NextResponse<PromotionRouteResponse>
> {
  try {
    const organizer =
      await getAuthenticatedOrganizer();

    if (!organizer) {
      return unauthorizedResponse();
    }

    const { eventId: rawEventId } =
      await context.params;

    const eventId =
      normalizeEventId(rawEventId);

    if (!eventId) {
      return invalidEventIdResponse();
    }

    let boostId: string | undefined;
    let reason: string | undefined;

    const contentLength =
      request.headers.get(
        "content-length",
      );

    if (
      contentLength &&
      contentLength !== "0"
    ) {
      if (!hasJsonContentType(request)) {
        return unsupportedContentTypeResponse();
      }

      const body =
        await parseJsonBody(request);

      if (!body) {
        return invalidJsonResponse();
      }

      if (
        typeof body.boostId ===
          "string" &&
        body.boostId.trim()
      ) {
        boostId =
          body.boostId.trim();
      }

      if (
        typeof body.reason ===
          "string" &&
        body.reason.trim()
      ) {
        reason =
          body.reason.trim();
      }
    }

    const input: RemovePromotedEventInput =
      {
        eventId,
        ...(boostId
          ? {
              boostId,
            }
          : {}),
        ...(reason
          ? {
              reason,
            }
          : {}),
      } as RemovePromotedEventInput;

    const result =
      await removePromotedEvent({
        organizerId: organizer.id,
        input,
      });

    return jsonResponse(
      {
        success: true,
        code: "PROMOTION_REMOVED",
        message: result.message,
        data: {
          boost: result.boost,
        },
      },
      200,
    );
  } catch (error) {
    if (
      error instanceof
      UpdatePromotedEventError
    ) {
      return handleKnownError(
        error,
        "[ORGANIZER_PROMOTED_EVENT_DELETE_REJECTED]",
      );
    }

    console.error(
      "[ORGANIZER_PROMOTED_EVENT_DELETE_ERROR]",
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
          "REMOVE_PROMOTION_FAILED",
        message:
          "Impossible de retirer cette promotion pour le moment.",
      },
      500,
    );
  }
}