import { createHash } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  getOrganizerPromotions,
  GetOrganizerPromotionsError,
  type OrganizerPromotionSubscription,
} from "@/lib/organizer/promotions/get-organizer-promotions";
import type {
  ActivateOrganizerSubscriptionInput,
  CancelOrganizerSubscriptionInput,
  CreateOrganizerSubscriptionInput,
  RenewOrganizerSubscriptionInput,
  UpdateAutoRenewInput,
} from "@/lib/organizer/promotions/promotion-schemas";
import {
  activateOrganizerSubscription,
  cancelOrganizerSubscription,
  createOrganizerSubscription,
  renewOrganizerSubscription,
  updateOrganizerSubscriptionAutoRenew,
  UpdateSubscriptionError,
  type UpdatedOrganizerSubscription,
} from "@/lib/organizer/promotions/update-subscription";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SESSION_COOKIE_FALLBACK_NAME =
  "tikemia_session";

type SubscriptionAction =
  | "CREATE"
  | "ACTIVATE"
  | "RENEW"
  | "CANCEL"
  | "UPDATE_AUTO_RENEW";

type AuthenticatedOrganizer = {
  id: string;
};

type SubscriptionRouteSuccessResponse =
  | {
      success: true;
      message: string;
      action: "READ";
      data: {
        subscription:
          | OrganizerPromotionSubscription
          | null;
      };
    }
  | {
      success: true;
      message: string;
      action: Exclude<
        SubscriptionAction,
        never
      >;
      redirectTo?: string;
      data: {
        subscription: UpdatedOrganizerSubscription;
        blueBadgeGranted?: boolean;
      };
    };

type SubscriptionRouteErrorResponse = {
  success: false;
  message: string;
  code: string;
  fields?: Record<string, string[]>;
  redirectTo?: string;
};

type SubscriptionRouteResponse =
  | SubscriptionRouteSuccessResponse
  | SubscriptionRouteErrorResponse;

type ActionRequestBody = {
  action?: unknown;
  [key: string]: unknown;
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
  body: SubscriptionRouteResponse,
  status: number,
): NextResponse<SubscriptionRouteResponse> {
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

function normalizeAction(
  value: unknown,
): SubscriptionAction | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized =
    value.trim().toUpperCase();

  switch (normalized) {
    case "CREATE":
    case "ACTIVATE":
    case "RENEW":
    case "CANCEL":
    case "UPDATE_AUTO_RENEW":
      return normalized;

    default:
      return null;
  }
}

function removeActionField(
  body: ActionRequestBody,
): Record<string, unknown> {
  const payload = { ...body };

  delete payload.action;

  return payload;
}

async function parseJsonBody(
  request: Request,
): Promise<ActionRequestBody | null> {
  try {
    const body: unknown =
      await request.json();

    return isRecord(body)
      ? body
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
          "[PROMOTIONS_SUBSCRIPTION_EXPIRED_SESSION_DELETE_ERROR]",
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

async function executeAction({
  organizerId,
  action,
  payload,
}: {
  organizerId: string;
  action: SubscriptionAction;
  payload: Record<string, unknown>;
}): Promise<
  NextResponse<SubscriptionRouteResponse>
> {
  try {
    switch (action) {
      case "CREATE": {
        const result =
          await createOrganizerSubscription({
            organizerId,
            input:
              payload as CreateOrganizerSubscriptionInput,
          });

        return jsonResponse(
          {
            success: true,
            action,
            message: result.message,
            redirectTo:
              result.redirectTo,
            data: {
              subscription:
                result.subscription,
              blueBadgeGranted:
                result.blueBadgeGranted,
            },
          },
          201,
        );
      }

      case "ACTIVATE": {
        const result =
          await activateOrganizerSubscription({
            organizerId,
            input:
              payload as ActivateOrganizerSubscriptionInput,
          });

        return jsonResponse(
          {
            success: true,
            action,
            message: result.message,
            redirectTo:
              result.redirectTo,
            data: {
              subscription:
                result.subscription,
              blueBadgeGranted:
                result.blueBadgeGranted,
            },
          },
          200,
        );
      }

      case "RENEW": {
        const result =
          await renewOrganizerSubscription({
            organizerId,
            input:
              payload as RenewOrganizerSubscriptionInput,
          });

        return jsonResponse(
          {
            success: true,
            action,
            message: result.message,
            redirectTo:
              result.redirectTo,
            data: {
              subscription:
                result.subscription,
              blueBadgeGranted:
                result.blueBadgeGranted,
            },
          },
          201,
        );
      }

      case "CANCEL": {
        const result =
          await cancelOrganizerSubscription({
            organizerId,
            input:
              payload as CancelOrganizerSubscriptionInput,
          });

        return jsonResponse(
          {
            success: true,
            action,
            message: result.message,
            redirectTo:
              result.redirectTo,
            data: {
              subscription:
                result.subscription,
              blueBadgeGranted:
                result.blueBadgeGranted,
            },
          },
          200,
        );
      }

      case "UPDATE_AUTO_RENEW": {
        const result =
          await updateOrganizerSubscriptionAutoRenew({
            organizerId,
            input:
              payload as UpdateAutoRenewInput,
          });

        return jsonResponse(
          {
            success: true,
            action,
            message: result.message,
            redirectTo:
              result.redirectTo,
            data: {
              subscription:
                result.subscription,
              blueBadgeGranted:
                result.blueBadgeGranted,
            },
          },
          200,
        );
      }
    }
  } catch (error) {
    if (
      error instanceof
      UpdateSubscriptionError
    ) {
      console.warn(
        "[ORGANIZER_PROMOTIONS_SUBSCRIPTION_REJECTED]",
        {
          action,
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
          redirectTo:
            error.redirectTo,
        },
        error.status,
      );
    }

    console.error(
      "[ORGANIZER_PROMOTIONS_SUBSCRIPTION_ACTION_ERROR]",
      error instanceof Error
        ? {
            action,
            name: error.name,
            message: error.message,
            stack:
              process.env.NODE_ENV ===
              "development"
                ? error.stack
                : undefined,
          }
        : {
            action,
            error,
          },
    );

    return jsonResponse(
      {
        success: false,
        code:
          "SUBSCRIPTION_ACTION_FAILED",
        message:
          "Impossible de traiter l’abonnement Premium pour le moment.",
      },
      500,
    );
  }
}

export async function GET(): Promise<
  NextResponse<SubscriptionRouteResponse>
> {
  try {
    const data =
      await getOrganizerPromotions({
        includeHistory: false,
        includeAvailableEvents: false,
        includePlans: false,
        page: 1,
        pageSize: 1,
      });

    return jsonResponse(
      {
        success: true,
        action: "READ",
        message:
          "L’abonnement Premium a été chargé avec succès.",
        data: {
          subscription:
            data.currentSubscription,
        },
      },
      200,
    );
  } catch (error) {
    if (
      error instanceof
      GetOrganizerPromotionsError
    ) {
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

    console.error(
      "[GET_ORGANIZER_PROMOTIONS_SUBSCRIPTION_ROUTE_ERROR]",
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
          "GET_SUBSCRIPTION_FAILED",
        message:
          "Impossible de charger l’abonnement Premium pour le moment.",
      },
      500,
    );
  }
}

export async function POST(
  request: Request,
): Promise<
  NextResponse<SubscriptionRouteResponse>
> {
  if (!hasJsonContentType(request)) {
    return unsupportedContentTypeResponse();
  }

  const organizer =
    await getAuthenticatedOrganizer();

  if (!organizer) {
    return unauthorizedResponse();
  }

  const body =
    await parseJsonBody(request);

  if (!body) {
    return invalidJsonResponse();
  }

  const action =
    normalizeAction(body.action) ??
    "CREATE";

  if (
    action !== "CREATE" &&
    action !== "ACTIVATE" &&
    action !== "RENEW"
  ) {
    return jsonResponse(
      {
        success: false,
        code: "INVALID_ACTION",
        message:
          "Cette action n’est pas autorisée avec la méthode POST.",
      },
      405,
    );
  }

  return executeAction({
    organizerId: organizer.id,
    action,
    payload:
      removeActionField(body),
  });
}

export async function PATCH(
  request: Request,
): Promise<
  NextResponse<SubscriptionRouteResponse>
> {
  if (!hasJsonContentType(request)) {
    return unsupportedContentTypeResponse();
  }

  const organizer =
    await getAuthenticatedOrganizer();

  if (!organizer) {
    return unauthorizedResponse();
  }

  const body =
    await parseJsonBody(request);

  if (!body) {
    return invalidJsonResponse();
  }

  const action =
    normalizeAction(body.action);

  if (
    action !== "UPDATE_AUTO_RENEW" &&
    action !== "CANCEL" &&
    action !== "RENEW"
  ) {
    return jsonResponse(
      {
        success: false,
        code: "INVALID_ACTION",
        message:
          "L’action PATCH doit être UPDATE_AUTO_RENEW, CANCEL ou RENEW.",
      },
      400,
    );
  }

  return executeAction({
    organizerId: organizer.id,
    action,
    payload:
      removeActionField(body),
  });
}

export async function DELETE(
  request: Request,
): Promise<
  NextResponse<SubscriptionRouteResponse>
> {
  const organizer =
    await getAuthenticatedOrganizer();

  if (!organizer) {
    return unauthorizedResponse();
  }

  let payload: Record<
    string,
    unknown
  > = {
    cancelAtPeriodEnd: true,
  };

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

    payload = {
      ...removeActionField(body),
      cancelAtPeriodEnd:
        body.cancelAtPeriodEnd ??
        true,
    };
  }

  return executeAction({
    organizerId: organizer.id,
    action: "CANCEL",
    payload,
  });
}