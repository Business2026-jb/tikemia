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

const addFavoriteSchema = z
  .object({
    eventId: z
      .string()
      .trim()
      .min(1, "L’événement est obligatoire.")
      .max(100, "L’identifiant de l’événement est invalide."),
  })
  .strict();

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

function hashSessionToken(token: string): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

async function getAuthenticatedCustomer() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore
    .get(CLIENT_SESSION_COOKIE_NAME)
    ?.value?.trim();

  if (!sessionToken) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: {
      tokenHash: hashSessionToken(sessionToken),
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

export async function GET() {
  try {
    const customer = await getAuthenticatedCustomer();

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

    const now = new Date();

    const favorites = await prisma.eventFavorite.findMany({
      where: {
        userId: customer.id,
        event: {
          status: "PUBLISHED",
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        createdAt: true,
        event: {
          select: {
            id: true,
            slug: true,
            title: true,
            shortDescription: true,
            description: true,
            coverImage: true,
            venueName: true,
            city: true,
            country: true,
            startsAt: true,
            endsAt: true,
            currency: true,
            status: true,
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            ticketTypes: {
              where: {
                isActive: true,
              },
              orderBy: {
                price: "asc",
              },
              select: {
                id: true,
                name: true,
                price: true,
                quantity: true,
                sold: true,
              },
            },
          },
        },
      },
    });

    const items = favorites.map((favorite) => {
      const availableTicketTypes =
        favorite.event.ticketTypes.filter(
          (ticketType) =>
            ticketType.quantity - ticketType.sold > 0,
        );

      const lowestPrice =
        availableTicketTypes[0]?.price ??
        favorite.event.ticketTypes[0]?.price ??
        null;

      return {
        id: favorite.id,
        createdAt: favorite.createdAt.toISOString(),
        event: {
          id: favorite.event.id,
          slug: favorite.event.slug,
          title: favorite.event.title,
          shortDescription:
            favorite.event.shortDescription ??
            favorite.event.description?.slice(0, 180) ??
            null,
          coverImage: favorite.event.coverImage,
          venueName: favorite.event.venueName,
          city: favorite.event.city,
          country: favorite.event.country,
          startsAt: favorite.event.startsAt.toISOString(),
          endsAt:
            favorite.event.endsAt?.toISOString() ?? null,
          currency: favorite.event.currency,
          category: favorite.event.category,
          lowestPrice: lowestPrice?.toFixed(2) ?? null,
          isFree: lowestPrice ? lowestPrice.equals(0) : false,
          isUpcoming: favorite.event.startsAt > now,
          availableTicketsCount:
            availableTicketTypes.reduce(
              (total, ticketType) =>
                total +
                Math.max(
                  0,
                  ticketType.quantity - ticketType.sold,
                ),
              0,
            ),
        },
      };
    });

    return jsonResponse({
      success: true,
      message:
        items.length > 0
          ? "Favoris chargés."
          : "Vous n’avez encore aucun favori.",
      summary: {
        count: items.length,
      },
      favorites: items,
    });
  } catch (error) {
    console.error("[CLIENT_FAVORITES_GET_ERROR]", error);

    return jsonResponse(
      {
        success: false,
        code: "INTERNAL_ERROR",
        message:
          "Impossible de charger vos favoris pour le moment.",
      },
      500,
    );
  }
}

export async function POST(request: Request) {
  try {
    const customer = await getAuthenticatedCustomer();

    if (!customer) {
      return jsonResponse(
        {
          success: false,
          code: "UNAUTHORIZED",
          message:
            "Connectez-vous à votre compte Tikemia pour ajouter un favori.",
        },
        401,
      );
    }

    let rawBody: unknown;

    try {
      rawBody = await request.json();
    } catch {
      return jsonResponse(
        {
          success: false,
          code: "INVALID_JSON",
          message: "La requête envoyée est invalide.",
        },
        400,
      );
    }

    const parsedBody = addFavoriteSchema.safeParse(rawBody);

    if (!parsedBody.success) {
      return jsonResponse(
        {
          success: false,
          code: "INVALID_REQUEST",
          message:
            parsedBody.error.issues[0]?.message ||
            "L’événement sélectionné est invalide.",
        },
        400,
      );
    }

    const { eventId } = parsedBody.data;

    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        status: "PUBLISHED",
      },
      select: {
        id: true,
        slug: true,
        title: true,
        coverImage: true,
        venueName: true,
        city: true,
        country: true,
        startsAt: true,
      },
    });

    if (!event) {
      return jsonResponse(
        {
          success: false,
          code: "EVENT_NOT_FOUND",
          message:
            "Cet événement est introuvable ou indisponible.",
        },
        404,
      );
    }

    const existingFavorite =
      await prisma.eventFavorite.findUnique({
        where: {
          userId_eventId: {
            userId: customer.id,
            eventId: event.id,
          },
        },
        select: {
          id: true,
          createdAt: true,
        },
      });

    if (existingFavorite) {
      return jsonResponse({
        success: true,
        code: "ALREADY_FAVORITE",
        message:
          "Cet événement est déjà dans vos favoris.",
        favorite: {
          id: existingFavorite.id,
          createdAt:
            existingFavorite.createdAt.toISOString(),
          event: {
            ...event,
            startsAt: event.startsAt.toISOString(),
          },
        },
      });
    }

    const favorite =
      await prisma.eventFavorite.create({
        data: {
          userId: customer.id,
          eventId: event.id,
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
            },
          },
        },
      });

    return jsonResponse(
      {
        success: true,
        message:
          "Événement ajouté à vos favoris.",
        favorite: {
          id: favorite.id,
          createdAt:
            favorite.createdAt.toISOString(),
          event: {
            ...favorite.event,
            startsAt:
              favorite.event.startsAt.toISOString(),
          },
        },
      },
      201,
    );
  } catch (error) {
    console.error("[CLIENT_FAVORITES_POST_ERROR]", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return jsonResponse({
        success: true,
        code: "ALREADY_FAVORITE",
        message:
          "Cet événement est déjà dans vos favoris.",
      });
    }

    return jsonResponse(
      {
        success: false,
        code: "INTERNAL_ERROR",
        message:
          "Impossible d’ajouter cet événement aux favoris pour le moment.",
      },
      500,
    );
  }
}