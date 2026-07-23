import { createHash } from "node:crypto";

import { EventStatus } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  createEvent,
  CreateEventError,
  type CreateEventInput,
} from "@/lib/events/create-event";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_REQUEST_SIZE_BYTES = 1_000_000;

type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INVALID_QUERY"
  | "UNSUPPORTED_CONTENT_TYPE"
  | "REQUEST_TOO_LARGE"
  | "INVALID_JSON"
  | "INVALID_REQUEST_BODY"
  | "INTERNAL_ERROR"
  | "INTERNAL_SERVER_ERROR";

type ErrorResponseBody = {
  success: false;
  error: {
    code: string;
    message: string;
    fields?: Record<string, string[]>;
    redirectTo?: string;
  };
};

type CreateEventResponseBody = {
  success: boolean;
  message: string;
  data?: Awaited<ReturnType<typeof createEvent>>;
  code?: string;
  fields?: Record<string, string[]>;
  redirectTo?: string;
};

function hashSessionToken(token: string): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

function noStoreHeaders(): HeadersInit {
  return {
    "Cache-Control":
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  };
}

function errorResponse({
  code,
  message,
  status,
  fields,
  redirectTo,
}: {
  code: ErrorCode | string;
  message: string;
  status: number;
  fields?: Record<string, string[]>;
  redirectTo?: string;
}): NextResponse<ErrorResponseBody> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(fields ? { fields } : {}),
        ...(redirectTo ? { redirectTo } : {}),
      },
    },
    {
      status,
      headers: noStoreHeaders(),
    },
  );
}

function createEventJsonResponse(
  body: CreateEventResponseBody,
  status: number,
): NextResponse<CreateEventResponseBody> {
  return NextResponse.json(body, {
    status,
    headers: noStoreHeaders(),
  });
}

function parsePositiveInteger(
  value: string | null,
  fallback: number,
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < 1
  ) {
    return fallback;
  }

  return parsed;
}

function normalizeSearch(
  value: string | null,
): string {
  return value?.trim().slice(0, 120) ?? "";
}

function normalizeStatus(
  value: string | null,
): EventStatus | null {
  if (!value) {
    return null;
  }

  const normalized = value
    .trim()
    .toUpperCase();

  return Object.values(EventStatus).includes(
    normalized as EventStatus,
  )
    ? (normalized as EventStatus)
    : null;
}

function getRequestContentLength(
  request: Request,
): number | null {
  const contentLength =
    request.headers.get("content-length");

  if (!contentLength) {
    return null;
  }

  const parsedContentLength =
    Number(contentLength);

  if (
    !Number.isFinite(parsedContentLength) ||
    parsedContentLength < 0
  ) {
    return null;
  }

  return parsedContentLength;
}

async function getAuthenticatedOrganizer() {
  const cookieStore = await cookies();

  const sessionCookieName =
    process.env.SESSION_COOKIE_NAME?.trim() ||
    "tikemia_session";

  const rawSessionToken =
    cookieStore.get(sessionCookieName)?.value;

  if (!rawSessionToken) {
    return null;
  }

  const tokenHash =
    hashSessionToken(rawSessionToken);

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
            isActive: true,
            emailVerified: true,
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
          "[ORGANIZER_EVENTS_EXPIRED_SESSION_DELETE_ERROR]",
          error instanceof Error
            ? error.message
            : error,
        );
      });

    return null;
  }

  return session.user;
}

function isOrganizerAllowed(
  organizer: Awaited<
    ReturnType<typeof getAuthenticatedOrganizer>
  >,
): organizer is NonNullable<
  Awaited<
    ReturnType<typeof getAuthenticatedOrganizer>
  >
> {
  return Boolean(
    organizer &&
      organizer.role === "ORGANIZER" &&
      organizer.isActive &&
      organizer.emailVerified,
  );
}

export async function GET(
  request: Request,
) {
  try {
    const organizer =
      await getAuthenticatedOrganizer();

    if (!organizer) {
      return errorResponse({
        code: "UNAUTHORIZED",
        status: 401,
        message:
          "Votre session a expiré. Connectez-vous de nouveau.",
        redirectTo: "/organizer/login",
      });
    }

    if (
      organizer.role !== "ORGANIZER"
    ) {
      return errorResponse({
        code: "FORBIDDEN",
        status: 403,
        message:
          "Ce compte ne correspond pas à un espace organisateur.",
      });
    }

    if (
      !organizer.isActive ||
      !organizer.emailVerified
    ) {
      return errorResponse({
        code: "FORBIDDEN",
        status: 403,
        message:
          "Votre compte organisateur ne peut pas accéder à cette ressource.",
      });
    }

    const url = new URL(request.url);
    const searchParams =
      url.searchParams;

    const page =
      parsePositiveInteger(
        searchParams.get("page"),
        DEFAULT_PAGE,
      );

    const requestedPageSize =
      parsePositiveInteger(
        searchParams.get("pageSize"),
        DEFAULT_PAGE_SIZE,
      );

    const pageSize = Math.min(
      requestedPageSize,
      MAX_PAGE_SIZE,
    );

    const search = normalizeSearch(
      searchParams.get("search") ??
        searchParams.get("q"),
    );

    const rawStatus =
      searchParams.get("status");

    const status =
      normalizeStatus(rawStatus);

    if (
      rawStatus &&
      !status
    ) {
      return errorResponse({
        code: "INVALID_QUERY",
        status: 400,
        message:
          "Le statut d’événement demandé n’est pas valide.",
      });
    }

    const where = {
      organizerId: organizer.id,

      ...(status
        ? {
            status,
          }
        : {}),

      ...(search
        ? {
            OR: [
              {
                title: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                city: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                country: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                venueName: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
    };

    const skip =
      (page - 1) * pageSize;

    const [events, total] =
      await Promise.all([
        prisma.event.findMany({
          where,
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            startsAt: true,
            endsAt: true,
            currency: true,

            description: true,
            coverImage: true,
            venueName: true,
            address: true,
            city: true,
            country: true,
            countryCode: true,
            timezone: true,
            salesStartAt: true,
            salesEndAt: true,
            capacity: true,
            publishedAt: true,
            createdAt: true,
            updatedAt: true,

            category: {
              select: {
                id: true,
                name: true,
                slug: true,
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
              take: 1,
              select: {
                id: true,
                publicUrl: true,
                isCover: true,
              },
            },

            _count: {
              select: {
                ticketTypes: true,
                orders: true,
                tickets: true,
              },
            },
          },
          orderBy: [
            {
              startsAt: "desc",
            },
            {
              createdAt: "desc",
            },
          ],
          skip,
          take: pageSize,
        }),

        prisma.event.count({
          where,
        }),
      ]);

    const normalizedEvents =
      events.map((event) => ({
        id: event.id,
        title: event.title,
        slug: event.slug,
        status: event.status,
        startsAt:
          event.startsAt.toISOString(),
        endsAt:
          event.endsAt?.toISOString() ??
          "",
        currency:
          event.currency
            .trim()
            .toUpperCase() || "XOF",

        description:
          event.description,
        coverImage:
          event.coverImage ??
          event.images[0]?.publicUrl ??
          null,
        venueName:
          event.venueName,
        address:
          event.address,
        city:
          event.city,
        country:
          event.country,
        countryCode:
          event.countryCode,
        timezone:
          event.timezone,
        salesStartAt:
          event.salesStartAt?.toISOString() ??
          null,
        salesEndAt:
          event.salesEndAt?.toISOString() ??
          null,
        capacity:
          event.capacity,
        publishedAt:
          event.publishedAt?.toISOString() ??
          null,
        createdAt:
          event.createdAt.toISOString(),
        updatedAt:
          event.updatedAt.toISOString(),
        category:
          event.category,
        counts: {
          ticketTypes:
            event._count.ticketTypes,
          orders:
            event._count.orders,
          tickets:
            event._count.tickets,
        },
      }));

    const totalPages =
      total === 0
        ? 0
        : Math.ceil(total / pageSize);

    return NextResponse.json(
      {
        success: true,
        data: {
          events:
            normalizedEvents,
          pagination: {
            page,
            pageSize,
            total,
            totalPages,
            hasPreviousPage:
              page > 1,
            hasNextPage:
              page < totalPages,
          },
        },
      },
      {
        status: 200,
        headers: noStoreHeaders(),
      },
    );
  } catch (error) {
    console.error(
      "[ORGANIZER_EVENTS_LIST_ERROR]",
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

    return errorResponse({
      code: "INTERNAL_ERROR",
      status: 500,
      message:
        "Impossible de charger les événements pour le moment.",
    });
  }
}

export async function POST(
  request: Request,
): Promise<
  NextResponse<CreateEventResponseBody>
> {
  try {
    const contentType =
      request.headers.get("content-type") ?? "";

    if (
      !contentType
        .toLowerCase()
        .includes("application/json")
    ) {
      return createEventJsonResponse(
        {
          success: false,
          code: "UNSUPPORTED_CONTENT_TYPE",
          message:
            "Le format de la requête n’est pas pris en charge.",
        },
        415,
      );
    }

    const contentLength =
      getRequestContentLength(request);

    if (
      contentLength !== null &&
      contentLength > MAX_REQUEST_SIZE_BYTES
    ) {
      return createEventJsonResponse(
        {
          success: false,
          code: "REQUEST_TOO_LARGE",
          message:
            "Les informations envoyées sont trop volumineuses.",
        },
        413,
      );
    }

    const organizer =
      await getAuthenticatedOrganizer();

    if (!organizer) {
      return createEventJsonResponse(
        {
          success: false,
          code: "UNAUTHORIZED",
          message:
            "Votre session est absente, invalide ou expirée.",
          redirectTo: "/organizer/login",
        },
        401,
      );
    }

    if (!isOrganizerAllowed(organizer)) {
      return createEventJsonResponse(
        {
          success: false,
          code: "FORBIDDEN",
          message:
            "Votre compte organisateur ne peut pas créer d’événement.",
        },
        403,
      );
    }

    let requestBody: unknown;

    try {
      requestBody = await request.json();
    } catch {
      return createEventJsonResponse(
        {
          success: false,
          code: "INVALID_JSON",
          message:
            "Les informations envoyées ne sont pas valides.",
        },
        400,
      );
    }

    if (
      !requestBody ||
      typeof requestBody !== "object" ||
      Array.isArray(requestBody)
    ) {
      return createEventJsonResponse(
        {
          success: false,
          code: "INVALID_REQUEST_BODY",
          message:
            "Les informations de l’événement sont invalides.",
        },
        400,
      );
    }

    /*
     * L’identifiant de l’organisateur provient
     * exclusivement de la session sécurisée.
     *
     * Toute valeur organizerId envoyée depuis
     * le navigateur est volontairement remplacée.
     */
    const eventInput = {
      ...(requestBody as Record<string, unknown>),
      organizerId: organizer.id,
    } as CreateEventInput;

    const result =
      await createEvent(eventInput);

    const isDraft =
      result.event.status === "DRAFT";

    return createEventJsonResponse(
      {
        success: true,
        message: isDraft
          ? "L’événement a été enregistré comme brouillon."
          : "L’événement a été publié avec succès.",
        data: result,
        redirectTo: `/organizer/events/${result.event.id}`,
      },
      201,
    );
  } catch (error) {
    if (
      error instanceof CreateEventError
    ) {
      return createEventJsonResponse(
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
      "[ORGANIZER_CREATE_EVENT_ROUTE_ERROR]",
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

    return createEventJsonResponse(
      {
        success: false,
        code: "INTERNAL_SERVER_ERROR",
        message:
          "Impossible de créer l’événement pour le moment. Réessayez.",
      },
      500,
    );
  }
}