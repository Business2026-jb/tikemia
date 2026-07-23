import { createHash } from "node:crypto";

import {
  EventModerationAction,
  EventStatus,
  NotificationType,
  type Prisma,
} from "@prisma/client";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SESSION_COOKIE_FALLBACK_NAME =
  "tikemia_session";

const MAX_REQUEST_SIZE_BYTES =
  250_000;

type AdminEventRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type AdminEventAction =
  | "APPROVE"
  | "REJECT"
  | "SUSPEND"
  | "RESTORE"
  | "CANCEL"
  | "ARCHIVE";

type DeleteRequestBody = {
  confirmation?: string;
  reason?: string;
};

type ApiResponse = {
  success: boolean;
  message: string;
  code?: string;
  data?: unknown;
  fields?: Record<string, string[]>;
  redirectTo?: string;
};

type AuthenticatedAdmin = {
  id: string;
};

type ModerationTransition = {
  action: EventModerationAction;
  nextStatus: EventStatus;
  reasonRequired: boolean;
  notificationTitle: string;
  notificationMessage: string;
  activityTitle: string;
  activityDescription: string;
  eventUpdate: Prisma.EventUpdateInput;
};

function jsonResponse(
  body: ApiResponse,
  status: number,
): NextResponse<ApiResponse> {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control":
        "no-store, no-cache, must-revalidate, proxy-revalidate",
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

function normalizeOptionalText(
  value: unknown,
  maximumLength: number,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized =
    value.trim().slice(0, maximumLength);

  return normalized || null;
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

function getRequestContentLength(
  request: Request,
): number | null {
  const contentLength =
    request.headers.get("content-length");

  if (!contentLength) {
    return null;
  }

  const parsed = Number(contentLength);

  if (
    !Number.isFinite(parsed) ||
    parsed < 0
  ) {
    return null;
  }

  return parsed;
}

async function parseJsonBody(
  request: Request,
): Promise<Record<string, unknown> | null> {
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

async function getAuthenticatedAdmin(): Promise<AuthenticatedAdmin | null> {
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
          "[ADMIN_EVENT_EXPIRED_SESSION_DELETE_ERROR]",
          error instanceof Error
            ? error.message
            : error,
        );
      });

    return null;
  }

  if (
    session.user.role !== "ADMIN" ||
    !session.user.emailVerified ||
    !session.user.isActive
  ) {
    return null;
  }

  return {
    id: session.user.id,
  };
}

async function getRequestMetadata(): Promise<{
  ipAddress: string | null;
  userAgent: string | null;
}> {
  const headerStore = await headers();

  const forwardedFor =
    headerStore.get("x-forwarded-for");

  const ipAddress =
    forwardedFor
      ?.split(",")[0]
      ?.trim() ||
    headerStore
      .get("x-real-ip")
      ?.trim() ||
    null;

  const userAgent =
    headerStore
      .get("user-agent")
      ?.trim()
      .slice(0, 1_000) ||
    null;

  return {
    ipAddress,
    userAgent,
  };
}

function getModerationTransition({
  action,
  currentStatus,
  reason,
  notes,
}: {
  action: AdminEventAction;
  currentStatus: EventStatus;
  reason: string | null;
  notes: string | null;
}): ModerationTransition {
  const now = new Date();

  switch (action) {
    case "APPROVE": {
      if (
        currentStatus !== "PENDING" &&
        currentStatus !== "REJECTED"
      ) {
        throw new AdminEventRouteError({
          code: "INVALID_STATUS_TRANSITION",
          status: 409,
          message:
            "Seuls les événements en attente ou rejetés peuvent être approuvés.",
        });
      }

      return {
        action:
          EventModerationAction.APPROVE,
        nextStatus:
          EventStatus.PUBLISHED,
        reasonRequired: false,
        notificationTitle:
          "Événement publié",
        notificationMessage:
          "Votre événement a été approuvé et publié sur Tikemia.",
        activityTitle:
          "Événement publié par Tikemia",
        activityDescription:
          "L’administration Tikemia a approuvé et publié votre événement.",
        eventUpdate: {
          status:
            EventStatus.PUBLISHED,
          publishedAt: now,
          reviewedAt: now,
          rejectedAt: null,
          rejectionReason: null,
          suspendedAt: null,
          suspensionReason: null,
          archivedAt: null,
          adminNotes: notes,
        },
      };
    }

    case "REJECT": {
      if (
        currentStatus !== "PENDING" &&
        currentStatus !== "PUBLISHED"
      ) {
        throw new AdminEventRouteError({
          code: "INVALID_STATUS_TRANSITION",
          status: 409,
          message:
            "Cet événement ne peut pas être rejeté depuis son statut actuel.",
        });
      }

      return {
        action:
          EventModerationAction.REJECT,
        nextStatus:
          EventStatus.REJECTED,
        reasonRequired: true,
        notificationTitle:
          "Événement rejeté",
        notificationMessage:
          reason
            ? `Votre événement a été rejeté : ${reason}`
            : "Votre événement a été rejeté par l’administration Tikemia.",
        activityTitle:
          "Événement rejeté",
        activityDescription:
          reason
            ? `L’administration Tikemia a rejeté l’événement : ${reason}`
            : "L’administration Tikemia a rejeté l’événement.",
        eventUpdate: {
          status:
            EventStatus.REJECTED,
          reviewedAt: now,
          rejectedAt: now,
          rejectionReason: reason,
          publishedAt: null,
          suspendedAt: null,
          suspensionReason: null,
          adminNotes: notes,
        },
      };
    }

    case "SUSPEND": {
      if (
        currentStatus !== "PUBLISHED"
      ) {
        throw new AdminEventRouteError({
          code: "INVALID_STATUS_TRANSITION",
          status: 409,
          message:
            "Seul un événement publié peut être suspendu.",
        });
      }

      return {
        action:
          EventModerationAction.SUSPEND,
        nextStatus:
          EventStatus.SUSPENDED,
        reasonRequired: true,
        notificationTitle:
          "Événement suspendu",
        notificationMessage:
          reason
            ? `Votre événement a été suspendu : ${reason}`
            : "Votre événement a été suspendu par l’administration Tikemia.",
        activityTitle:
          "Événement suspendu",
        activityDescription:
          reason
            ? `L’administration Tikemia a suspendu l’événement : ${reason}`
            : "L’administration Tikemia a suspendu l’événement.",
        eventUpdate: {
          status:
            EventStatus.SUSPENDED,
          suspendedAt: now,
          suspensionReason: reason,
          reviewedAt: now,
          publishedAt: null,
          adminNotes: notes,
        },
      };
    }

    case "RESTORE": {
      if (
        currentStatus !== "SUSPENDED" &&
        currentStatus !== "REJECTED"
      ) {
        throw new AdminEventRouteError({
          code: "INVALID_STATUS_TRANSITION",
          status: 409,
          message:
            "Seul un événement suspendu ou rejeté peut être réactivé.",
        });
      }

      return {
        action:
          EventModerationAction.RESTORE,
        nextStatus:
          EventStatus.PUBLISHED,
        reasonRequired: false,
        notificationTitle:
          "Événement réactivé",
        notificationMessage:
          "Votre événement a été réactivé et est de nouveau publié sur Tikemia.",
        activityTitle:
          "Événement réactivé",
        activityDescription:
          "L’administration Tikemia a réactivé et republié l’événement.",
        eventUpdate: {
          status:
            EventStatus.PUBLISHED,
          publishedAt: now,
          reviewedAt: now,
          suspendedAt: null,
          suspensionReason: null,
          rejectedAt: null,
          rejectionReason: null,
          archivedAt: null,
          adminNotes: notes,
        },
      };
    }

    case "CANCEL": {
      if (
        currentStatus === "CANCELLED" ||
        currentStatus === "COMPLETED" ||
        currentStatus === "ARCHIVED"
      ) {
        throw new AdminEventRouteError({
          code: "INVALID_STATUS_TRANSITION",
          status: 409,
          message:
            "Cet événement ne peut plus être annulé depuis son statut actuel.",
        });
      }

      return {
        action:
          EventModerationAction.CANCEL,
        nextStatus:
          EventStatus.CANCELLED,
        reasonRequired: true,
        notificationTitle:
          "Événement annulé",
        notificationMessage:
          reason
            ? `Votre événement a été annulé : ${reason}`
            : "Votre événement a été annulé par l’administration Tikemia.",
        activityTitle:
          "Événement annulé",
        activityDescription:
          reason
            ? `L’administration Tikemia a annulé l’événement : ${reason}`
            : "L’administration Tikemia a annulé l’événement.",
        eventUpdate: {
          status:
            EventStatus.CANCELLED,
          cancelledAt: now,
          cancellationReason: reason,
          reviewedAt: now,
          publishedAt: null,
          adminNotes: notes,
        },
      };
    }

    case "ARCHIVE": {
      if (
        currentStatus === "ARCHIVED"
      ) {
        throw new AdminEventRouteError({
          code: "INVALID_STATUS_TRANSITION",
          status: 409,
          message:
            "Cet événement est déjà archivé.",
        });
      }

      return {
        action:
          EventModerationAction.ARCHIVE,
        nextStatus:
          EventStatus.ARCHIVED,
        reasonRequired: false,
        notificationTitle:
          "Événement archivé",
        notificationMessage:
          "Votre événement a été archivé par l’administration Tikemia.",
        activityTitle:
          "Événement archivé",
        activityDescription:
          "L’administration Tikemia a archivé l’événement.",
        eventUpdate: {
          status:
            EventStatus.ARCHIVED,
          archivedAt: now,
          reviewedAt: now,
          publishedAt: null,
          adminNotes: notes,
        },
      };
    }
  }
}

class AdminEventRouteError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fields?: Record<string, string[]>;

  constructor({
    code,
    status,
    message,
    fields,
  }: {
    code: string;
    status: number;
    message: string;
    fields?: Record<string, string[]>;
  }) {
    super(message);
    this.name = "AdminEventRouteError";
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

export async function GET(
  _request: Request,
  context: AdminEventRouteContext,
): Promise<NextResponse<ApiResponse>> {
  try {
    const admin =
      await getAuthenticatedAdmin();

    if (!admin) {
      return jsonResponse(
        {
          success: false,
          code: "UNAUTHORIZED",
          message:
            "Votre session administrateur est absente, invalide ou expirée.",
          redirectTo:
            "/admin/login",
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

    const event =
      await prisma.event.findUnique({
        where: {
          id: eventId,
        },
        select: {
          id: true,
          organizerId: true,
          categoryId: true,
          title: true,
          slug: true,
          description: true,
          shortDescription: true,
          coverImage: true,
          venueName: true,
          address: true,
          city: true,
          country: true,
          countryCode: true,
          timezone: true,
          latitude: true,
          longitude: true,
          startsAt: true,
          endsAt: true,
          salesStartAt: true,
          salesEndAt: true,
          currency: true,
          platformFeeRate: true,
          capacity: true,
          status: true,
          isFree: true,
          isFeatured: true,
          publishedAt: true,
          submittedAt: true,
          reviewedAt: true,
          reviewedById: true,
          rejectedAt: true,
          suspendedAt: true,
          cancelledAt: true,
          archivedAt: true,
          rejectionReason: true,
          suspensionReason: true,
          cancellationReason: true,
          adminNotes: true,
          createdAt: true,
          updatedAt: true,

          organizer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              country: true,
              isActive: true,
              emailVerified: true,
              organizerProfile: {
                select: {
                  businessName: true,
                  logo: true,
                  hasBlueBadge: true,
                  blueBadgeGrantedAt: true,
                  firstSubscribedAt: true,
                },
              },
            },
          },

          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              isActive: true,
            },
          },

          images: {
            orderBy: [
              {
                isCover: "desc",
              },
              {
                position: "asc",
              },
            ],
            select: {
              id: true,
              path: true,
              publicUrl: true,
              position: true,
              isCover: true,
              createdAt: true,
            },
          },

          ticketTypes: {
            orderBy: {
              createdAt: "asc",
            },
            select: {
              id: true,
              name: true,
              description: true,
              price: true,
              quantity: true,
              maxPerOrder: true,
              saleStartsAt: true,
              saleEndsAt: true,
              isActive: true,
              createdAt: true,
              updatedAt: true,
            },
          },

          moderationLogs: {
            orderBy: {
              createdAt: "desc",
            },
            take: 50,
            select: {
              id: true,
              action: true,
              previousStatus: true,
              newStatus: true,
              reason: true,
              notes: true,
              createdAt: true,
              admin: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },

          _count: {
            select: {
              orders: true,
              tickets: true,
              ticketTypes: true,
              images: true,
              boosts: true,
              platformReports: true,
            },
          },
        },
      });

    if (!event) {
      return jsonResponse(
        {
          success: false,
          code: "EVENT_NOT_FOUND",
          message:
            "Cet événement est introuvable.",
        },
        404,
      );
    }

    return jsonResponse(
      {
        success: true,
        message:
          "Événement chargé avec succès.",
        data: {
          event: {
            ...event,
            latitude:
              event.latitude === null
                ? null
                : Number(event.latitude),
            longitude:
              event.longitude === null
                ? null
                : Number(event.longitude),
            platformFeeRate:
              Number(
                event.platformFeeRate,
              ),
            ticketTypes:
              event.ticketTypes.map(
                (ticketType) => ({
                  ...ticketType,
                  price:
                    Number(
                      ticketType.price,
                    ),
                }),
              ),
          },
        },
      },
      200,
    );
  } catch (error) {
    console.error(
      "[ADMIN_EVENT_DETAILS_ROUTE_ERROR]",
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
        code: "INTERNAL_SERVER_ERROR",
        message:
          "Impossible de charger cet événement pour le moment.",
      },
      500,
    );
  }
}

export async function PATCH(
  request: Request,
  context: AdminEventRouteContext,
): Promise<NextResponse<ApiResponse>> {
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

    const contentLength =
      getRequestContentLength(request);

    if (
      contentLength !== null &&
      contentLength >
        MAX_REQUEST_SIZE_BYTES
    ) {
      return jsonResponse(
        {
          success: false,
          code: "REQUEST_TOO_LARGE",
          message:
            "Les informations envoyées sont trop volumineuses.",
        },
        413,
      );
    }

    const admin =
      await getAuthenticatedAdmin();

    if (!admin) {
      return jsonResponse(
        {
          success: false,
          code: "UNAUTHORIZED",
          message:
            "Votre session administrateur est absente, invalide ou expirée.",
          redirectTo:
            "/admin/login",
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

    const rawBody =
      await parseJsonBody(request);

    if (!rawBody) {
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

    const action =
      typeof rawBody.action === "string"
        ? rawBody.action
            .trim()
            .toUpperCase()
        : "";

    const allowedActions: AdminEventAction[] = [
      "APPROVE",
      "REJECT",
      "SUSPEND",
      "RESTORE",
      "CANCEL",
      "ARCHIVE",
    ];

    if (
      !allowedActions.includes(
        action as AdminEventAction,
      )
    ) {
      return jsonResponse(
        {
          success: false,
          code: "INVALID_ACTION",
          message:
            "L’action administrative demandée n’est pas valide.",
          fields: {
            action: [
              "Sélectionnez une action administrative valide.",
            ],
          },
        },
        400,
      );
    }

    const reason =
      normalizeOptionalText(
        rawBody.reason,
        1_000,
      );

    const notes =
      normalizeOptionalText(
        rawBody.notes,
        2_000,
      );

    const existingEvent =
      await prisma.event.findUnique({
        where: {
          id: eventId,
        },
        select: {
          id: true,
          title: true,
          status: true,
          organizerId: true,
          currency: true,
        },
      });

    if (!existingEvent) {
      return jsonResponse(
        {
          success: false,
          code: "EVENT_NOT_FOUND",
          message:
            "Cet événement est introuvable.",
        },
        404,
      );
    }

    const transition =
      getModerationTransition({
        action:
          action as AdminEventAction,
        currentStatus:
          existingEvent.status,
        reason,
        notes,
      });

    if (
      transition.reasonRequired &&
      !reason
    ) {
      return jsonResponse(
        {
          success: false,
          code: "REASON_REQUIRED",
          message:
            "Une raison est obligatoire pour cette action.",
          fields: {
            reason: [
              "Renseignez une raison claire et précise.",
            ],
          },
        },
        400,
      );
    }

    const requestMetadata =
      await getRequestMetadata();

    const updatedEvent =
      await prisma.$transaction(
        async (transaction) => {
          const eventUpdate = {
            ...transition.eventUpdate,
            reviewedBy: {
              connect: {
                id: admin.id,
              },
            },
          } satisfies Prisma.EventUpdateInput;

          const event =
            await transaction.event.update({
              where: {
                id: existingEvent.id,
              },
              data: eventUpdate,
              select: {
                id: true,
                title: true,
                slug: true,
                status: true,
                publishedAt: true,
                reviewedAt: true,
                rejectedAt: true,
                suspendedAt: true,
                cancelledAt: true,
                archivedAt: true,
                rejectionReason: true,
                suspensionReason: true,
                cancellationReason: true,
                adminNotes: true,
                updatedAt: true,
              },
            });

          await transaction.eventModerationLog.create({
            data: {
              eventId:
                existingEvent.id,
              adminId:
                admin.id,
              action:
                transition.action,
              previousStatus:
                existingEvent.status,
              newStatus:
                transition.nextStatus,
              reason,
              notes,
              ipAddress:
                requestMetadata.ipAddress,
              userAgent:
                requestMetadata.userAgent,
              metadata: {
                eventTitle:
                  existingEvent.title,
                source:
                  "ADMIN_EVENT_DETAILS",
              },
            },
          });

          await transaction.adminAuditLog.create({
            data: {
              adminId:
                admin.id,
              action:
                `EVENT_${transition.action}`,
              targetType:
                "EVENT",
              targetId:
                existingEvent.id,
              reason,
              ipAddress:
                requestMetadata.ipAddress,
              userAgent:
                requestMetadata.userAgent,
              metadata: {
                previousStatus:
                  existingEvent.status,
                newStatus:
                  transition.nextStatus,
                notes,
              },
            },
          });

          await transaction.userNotification.create({
            data: {
              userId:
                existingEvent.organizerId,
              type:
                NotificationType.EVENT_STATUS,
              title:
                transition.notificationTitle,
              message:
                transition.notificationMessage,
              data: {
                eventId:
                  existingEvent.id,
                eventTitle:
                  existingEvent.title,
                previousStatus:
                  existingEvent.status,
                newStatus:
                  transition.nextStatus,
                reason,
              },
            },
          });

          await transaction.organizerActivity.create({
            data: {
              organizerId:
                existingEvent.organizerId,
              eventId:
                existingEvent.id,
              type:
                transition.nextStatus ===
                  EventStatus.PUBLISHED
                  ? "EVENT_PUBLISHED"
                  : transition.nextStatus ===
                      EventStatus.SUSPENDED
                    ? "EVENT_SUSPENDED"
                    : transition.nextStatus ===
                        EventStatus.CANCELLED
                      ? "EVENT_CANCELLED"
                      : transition.nextStatus ===
                          EventStatus.ARCHIVED
                        ? "EVENT_ARCHIVED"
                        : transition.nextStatus ===
                            EventStatus.REJECTED
                          ? "EVENT_REJECTED"
                          : "EVENT_CREATED",
              title:
                transition.activityTitle,
              description:
                transition.activityDescription,
              currency:
                existingEvent.currency,
              metadata: {
                previousStatus:
                  existingEvent.status,
                newStatus:
                  transition.nextStatus,
                reason,
                adminId:
                  admin.id,
              },
            },
          });

          return event;
        },
        {
          maxWait: 5_000,
          timeout: 15_000,
        },
      );

    return jsonResponse(
      {
        success: true,
        code:
          `EVENT_${transition.action}`,
        message:
          transition.notificationMessage,
        data: {
          event: updatedEvent,
        },
      },
      200,
    );
  } catch (error) {
    if (
      error instanceof
      AdminEventRouteError
    ) {
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
      "[ADMIN_EVENT_MODERATION_ROUTE_ERROR]",
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
        code: "INTERNAL_SERVER_ERROR",
        message:
          "Impossible d’appliquer cette action administrative pour le moment.",
      },
      500,
    );
  }
}

export async function DELETE(
  request: Request,
  context: AdminEventRouteContext,
): Promise<NextResponse<ApiResponse>> {
  try {
    const admin =
      await getAuthenticatedAdmin();

    if (!admin) {
      return jsonResponse(
        {
          success: false,
          code: "UNAUTHORIZED",
          message:
            "Votre session administrateur est absente, invalide ou expirée.",
          redirectTo:
            "/admin/login",
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

    let body: DeleteRequestBody = {};

    if (
      request.headers
        .get("content-length") !== "0" &&
      hasJsonContentType(request)
    ) {
      const rawBody =
        await parseJsonBody(request);

      if (rawBody) {
        body = {
          confirmation:
            normalizeOptionalText(
              rawBody.confirmation,
              100,
            ) ?? undefined,
          reason:
            normalizeOptionalText(
              rawBody.reason,
              1_000,
            ) ?? undefined,
        };
      }
    }

    if (
      body.confirmation !==
      "DELETE_EVENT"
    ) {
      return jsonResponse(
        {
          success: false,
          code:
            "DELETE_CONFIRMATION_REQUIRED",
          message:
            "La confirmation de suppression est invalide.",
          fields: {
            confirmation: [
              'Envoyez exactement "DELETE_EVENT" pour confirmer.',
            ],
          },
        },
        400,
      );
    }

    const existingEvent =
      await prisma.event.findUnique({
        where: {
          id: eventId,
        },
        select: {
          id: true,
          title: true,
          organizerId: true,
          status: true,
          _count: {
            select: {
              orders: true,
              tickets: true,
            },
          },
        },
      });

    if (!existingEvent) {
      return jsonResponse(
        {
          success: false,
          code: "EVENT_NOT_FOUND",
          message:
            "Cet événement est introuvable.",
        },
        404,
      );
    }

    if (
      existingEvent._count.orders > 0 ||
      existingEvent._count.tickets > 0
    ) {
      return jsonResponse(
        {
          success: false,
          code:
            "EVENT_HAS_COMMERCIAL_HISTORY",
          message:
            "Cet événement possède déjà des commandes ou des billets. Archivez-le au lieu de le supprimer.",
        },
        409,
      );
    }

    const requestMetadata =
      await getRequestMetadata();

    await prisma.$transaction(
      async (transaction) => {
        await transaction.adminAuditLog.create({
          data: {
            adminId:
              admin.id,
            action:
              "EVENT_DELETE",
            targetType:
              "EVENT",
            targetId:
              existingEvent.id,
            reason:
              body.reason ?? null,
            ipAddress:
              requestMetadata.ipAddress,
            userAgent:
              requestMetadata.userAgent,
            metadata: {
              eventTitle:
                existingEvent.title,
              previousStatus:
                existingEvent.status,
              organizerId:
                existingEvent.organizerId,
            },
          },
        });

        await transaction.event.delete({
          where: {
            id: existingEvent.id,
          },
        });
      },
      {
        maxWait: 5_000,
        timeout: 15_000,
      },
    );

    return jsonResponse(
      {
        success: true,
        code: "EVENT_DELETED",
        message:
          "L’événement a été supprimé définitivement.",
        data: {
          eventId:
            existingEvent.id,
        },
      },
      200,
    );
  } catch (error) {
    console.error(
      "[ADMIN_EVENT_DELETE_ROUTE_ERROR]",
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
        code: "INTERNAL_SERVER_ERROR",
        message:
          "Impossible de supprimer cet événement pour le moment.",
      },
      500,
    );
  }
}