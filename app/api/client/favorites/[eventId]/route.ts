import { createHash } from "node:crypto";

import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CLIENT_SESSION_COOKIE_NAME =
  process.env.CLIENT_SESSION_COOKIE_NAME?.trim() ||
  "tikemia_client_session";

const paramsSchema = z.object({
  eventId: z
    .string()
    .trim()
    .min(1, "L’identifiant de l’événement est obligatoire.")
    .max(100, "L’identifiant de l’événement est invalide."),
});

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
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

async function getAuthenticatedCustomer() {
  const cookieStore =
    await cookies();

  const sessionToken =
    cookieStore
      .get(CLIENT_SESSION_COOKIE_NAME)
      ?.value?.trim();

  if (!sessionToken) {
    return null;
  }

  const session =
    await prisma.session.findUnique({
      where: {
        tokenHash:
          hashSessionToken(sessionToken),
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
      .catch(() => undefined);

    return null;
  }

  if (
    session.user.role !== "CUSTOMER" ||
    !session.user.emailVerified ||
    !session.user.isActive
  ) {
    return null;
  }

  return session.user;
}

type RouteContext = {
  params: Promise<{
    eventId: string;
  }>;
};

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  try {
    const customer =
      await getAuthenticatedCustomer();

    if (!customer) {
      return jsonResponse(
        {
          success: false,
          code: "UNAUTHORIZED",
          message:
            "Connectez-vous à votre compte Tikemia pour consulter vos favoris.",
        },
        401,
      );
    }

    const rawParams =
      await context.params;

    const parsedParams =
      paramsSchema.safeParse(rawParams);

    if (!parsedParams.success) {
      return jsonResponse(
        {
          success: false,
          code: "INVALID_EVENT_ID",
          message:
            parsedParams.error.issues[0]?.message ||
            "L’événement sélectionné est invalide.",
        },
        400,
      );
    }

    const {
      eventId,
    } =
      parsedParams.data;

    const favorite =
      await prisma.eventFavorite.findUnique({
        where: {
          userId_eventId: {
            userId:
              customer.id,

            eventId,
          },
        },

        select: {
          id: true,
          createdAt: true,

          event: {
            select: {
              id: true,
              slug: true,
              title: true,
              coverImage: true,
              venueName: true,
              city: true,
              country: true,
              startsAt: true,
              status: true,
            },
          },
        },
      });

    if (!favorite) {
      return jsonResponse({
        success: true,
        isFavorite: false,
        favorite: null,
      });
    }

    return jsonResponse({
      success: true,
      isFavorite: true,

      favorite: {
        id:
          favorite.id,

        createdAt:
          favorite.createdAt.toISOString(),

        event: {
          ...favorite.event,

          startsAt:
            favorite.event.startsAt.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error(
      "[CLIENT_FAVORITE_GET_ERROR]",
      error,
    );

    return jsonResponse(
      {
        success: false,
        code: "INTERNAL_ERROR",
        message:
          "Impossible de vérifier ce favori pour le moment.",
      },
      500,
    );
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext,
) {
  try {
    const customer =
      await getAuthenticatedCustomer();

    if (!customer) {
      return jsonResponse(
        {
          success: false,
          code: "UNAUTHORIZED",
          message:
            "Connectez-vous à votre compte Tikemia pour modifier vos favoris.",
        },
        401,
      );
    }

    const rawParams =
      await context.params;

    const parsedParams =
      paramsSchema.safeParse(rawParams);

    if (!parsedParams.success) {
      return jsonResponse(
        {
          success: false,
          code: "INVALID_EVENT_ID",
          message:
            parsedParams.error.issues[0]?.message ||
            "L’événement sélectionné est invalide.",
        },
        400,
      );
    }

    const {
      eventId,
    } =
      parsedParams.data;

    const favorite =
      await prisma.eventFavorite.findUnique({
        where: {
          userId_eventId: {
            userId:
              customer.id,

            eventId,
          },
        },

        select: {
          id: true,

          event: {
            select: {
              id: true,
              slug: true,
              title: true,
            },
          },
        },
      });

    if (!favorite) {
      return jsonResponse({
        success: true,
        code: "ALREADY_REMOVED",
        message:
          "Cet événement n’est plus dans vos favoris.",

        removed: {
          eventId,
        },
      });
    }

    await prisma.eventFavorite.delete({
      where: {
        id:
          favorite.id,
      },
    });

    return jsonResponse({
      success: true,
      message:
        "Événement retiré de vos favoris.",

      removed: {
        favoriteId:
          favorite.id,

        eventId:
          favorite.event.id,

        eventSlug:
          favorite.event.slug,

        eventTitle:
          favorite.event.title,
      },
    });
  } catch (error) {
    console.error(
      "[CLIENT_FAVORITE_DELETE_ERROR]",
      error,
    );

    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return jsonResponse({
        success: true,
        code: "ALREADY_REMOVED",
        message:
          "Cet événement n’est plus dans vos favoris.",
      });
    }

    return jsonResponse(
      {
        success: false,
        code: "INTERNAL_ERROR",
        message:
          "Impossible de retirer cet événement des favoris pour le moment.",
      },
      500,
    );
  }
}