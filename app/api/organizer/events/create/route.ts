import { createHash } from "node:crypto";

import { EventStatus } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  createEvent,
  CreateEventError,
  type CreateEventInput,
} from "@/lib/events/create-event";
import {
  getOrganizerEvents,
  GetOrganizerEventsError,
  type GetOrganizerEventsResult,
  type OrganizerEventSort,
} from "@/lib/organizer/get-organizer-events";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_REQUEST_SIZE_BYTES = 1_000_000;
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

type CreateEventApiResponse = {
  success: boolean;
  message: string;
  data?: Awaited<ReturnType<typeof createEvent>>;
  code?: string;
  fields?: Record<string, string[]>;
  redirectTo?: string;
};

type GetEventsApiResponse = {
  success: boolean;
  message?: string;
  data?: GetOrganizerEventsResult;
  code?: string;
  redirectTo?: string;
};

function noStoreHeaders(): HeadersInit {
  return {
    "Cache-Control":
      "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
  };
}

function jsonResponse<T extends object>(
  body: T,
  status: number,
): NextResponse<T> {
  return NextResponse.json(body, {
    status,
    headers: noStoreHeaders(),
  });
}

function hashSessionToken(token: string): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

function getRequestContentLength(
  request: Request,
): number | null {
  const contentLength = request.headers.get(
    "content-length",
  );

  if (!contentLength) {
    return null;
  }

  const parsedContentLength = Number(contentLength);

  if (
    !Number.isFinite(parsedContentLength) ||
    parsedContentLength < 0
  ) {
    return null;
  }

  return parsedContentLength;
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

function parseEventStatus(
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

function parseEventStatuses(
  values: string[],
): EventStatus[] {
  return Array.from(
    new Set(
      values
        .flatMap((value) =>
          value
            .split(",")
            .map((item) =>
              item
                .trim()
                .toUpperCase(),
            ),
        )
        .filter((value): value is EventStatus =>
          Object.values(EventStatus).includes(
            value as EventStatus,
          ),
        ),
    ),
  );
}

function parseSort(
  value: string | null,
): OrganizerEventSort {
  const allowedSorts:
    OrganizerEventSort[] = [
      "recent",
      "oldest",
      "starts-soon",
      "starts-late",
      "title-asc",
      "title-desc",
    ];

  return allowedSorts.includes(
    value as OrganizerEventSort,
  )
    ? (value as OrganizerEventSort)
    : "recent";
}

async function getAuthenticatedOrganizer() {
  const sessionCookieName =
    process.env.SESSION_COOKIE_NAME?.trim() ||
    "tikemia_session";

  const cookieStore = await cookies();

  const sessionToken =
    cookieStore.get(sessionCookieName)?.value;

  if (!sessionToken) {
    return null;
  }

  const tokenHash = hashSessionToken(sessionToken);

  const session = await prisma.session.findUnique({
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

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session
      .delete({
        where: {
          id: session.id,
        },
      })
      .catch((error: unknown) => {
        console.error(
          "[CREATE_EVENT_EXPIRED_SESSION_DELETE_ERROR]",
          error instanceof Error
            ? error.message
            : error,
        );
      });

    return null;
  }

  if (
    session.user.role !== "ORGANIZER" ||
    !session.user.emailVerified ||
    !session.user.isActive
  ) {
    return null;
  }

  return session.user;
}

export async function GET(
  request: Request,
): Promise<NextResponse<GetEventsApiResponse>> {
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;

    const page = parsePositiveInteger(
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

    const rawStatus =
      searchParams.get("status");

    const status = parseEventStatus(rawStatus);

    if (
      rawStatus &&
      !status
    ) {
      return jsonResponse(
        {
          success: false,
          code: "INVALID_STATUS",
          message:
            "Le statut d’événement demandé n’est pas valide.",
        },
        400,
      );
    }

    const statuses =
      parseEventStatuses(
        searchParams.getAll("statuses"),
      );

    const result = await getOrganizerEvents({
      page,
      pageSize,
      search:
        searchParams.get("search") ??
        searchParams.get("q"),
      status,
      statuses:
        statuses.length > 0
          ? statuses
          : undefined,
      categoryId:
        searchParams.get("categoryId"),
      countryCode:
        searchParams.get("countryCode"),
      currency:
        searchParams.get("currency"),
      from:
        searchParams.get("from"),
      to:
        searchParams.get("to"),
      sort:
        parseSort(
          searchParams.get("sort"),
        ),
      includeCounts:
        searchParams.get("includeCounts") !==
        "false",
    });

    return jsonResponse(
      {
        success: true,
        data: result,
      },
      200,
    );
  } catch (error) {
    if (
      error instanceof
      GetOrganizerEventsError
    ) {
      return jsonResponse(
        {
          success: false,
          code: error.code,
          message: error.message,
          redirectTo:
            error.status === 401
              ? "/organizer/login"
              : undefined,
        },
        error.status,
      );
    }

    console.error(
      "[ORGANIZER_EVENTS_GET_ROUTE_ERROR]",
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
          "Impossible de charger les événements pour le moment.",
      },
      500,
    );
  }
}

export async function POST(
  request: Request,
): Promise<NextResponse<CreateEventApiResponse>> {
  try {
    const contentType =
      request.headers.get("content-type") ?? "";

    if (
      !contentType
        .toLowerCase()
        .includes("application/json")
    ) {
      return jsonResponse(
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

    const organizer =
      await getAuthenticatedOrganizer();

    if (!organizer) {
      return jsonResponse(
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

    let requestBody: unknown;

    try {
      requestBody = await request.json();
    } catch {
      return jsonResponse(
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
      return jsonResponse(
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
     * L’identifiant de l’organisateur vient uniquement
     * de la session sécurisée.
     *
     * Une éventuelle valeur organizerId envoyée depuis
     * le navigateur est volontairement ignorée.
     */
    const eventInput = {
      ...(requestBody as Record<string, unknown>),
      organizerId: organizer.id,
    } as CreateEventInput;

    const result = await createEvent(eventInput);

    const isDraft =
      result.event.status === "DRAFT";

    return jsonResponse(
      {
        success: true,
        message: isDraft
          ? "L’événement a été enregistré comme brouillon."
          : "L’événement a été envoyé pour validation.",
        data: result,
        redirectTo: `/organizer/events/${result.event.id}`,
      },
      201,
    );
  } catch (error) {
    if (error instanceof CreateEventError) {
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

    return jsonResponse(
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