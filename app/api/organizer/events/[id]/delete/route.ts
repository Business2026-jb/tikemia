import { createHash } from "node:crypto";

import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { removeEventImagesFromStorage } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type DeleteOrganizerEventRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

type DeleteEventResponse = {
  success: boolean;
  message: string;
  code?: string;
  redirectTo?: string;
  warning?: string;
  data?: {
    eventId: string;
    title: string;
  };
};

type AuthenticatedOrganizer = {
  id: string;
};

const SESSION_COOKIE_FALLBACK_NAME =
  "tikemia_session";

function jsonResponse(
  body: DeleteEventResponse,
  status: number,
): NextResponse<DeleteEventResponse> {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function hashSessionToken(token: string): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

async function getAuthenticatedOrganizer(): Promise<AuthenticatedOrganizer | null> {
  const cookieStore = await cookies();

  const sessionCookieName =
    process.env.SESSION_COOKIE_NAME?.trim() ||
    SESSION_COOKIE_FALLBACK_NAME;

  const sessionToken =
    cookieStore.get(sessionCookieName)?.value;

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
      .catch((error: unknown) => {
        console.error(
          "[DELETE_EVENT_EXPIRED_SESSION_DELETE_ERROR]",
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

  return {
    id: session.user.id,
  };
}

function normalizeEventId(value: string): string {
  return value.trim();
}

export async function DELETE(
  _request: Request,
  { params }: DeleteOrganizerEventRouteProps,
): Promise<NextResponse<DeleteEventResponse>> {
  try {
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

    const { id: rawEventId } = await params;
    const eventId = normalizeEventId(rawEventId);

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

    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        organizerId: organizer.id,
      },

      select: {
        id: true,
        title: true,
        status: true,

        images: {
          select: {
            path: true,
          },
        },

        _count: {
          select: {
            orders: true,
            tickets: true,
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
            "Cet événement est introuvable ou ne vous appartient pas.",
        },
        404,
      );
    }

    const deletableStatuses = [
      "DRAFT",
      "PENDING",
    ] as const;

    if (
      !deletableStatuses.includes(
        event.status as
          | "DRAFT"
          | "PENDING",
      )
    ) {
      return jsonResponse(
        {
          success: false,
          code: "EVENT_STATUS_NOT_DELETABLE",
          message:
            event.status === "PUBLISHED"
              ? "Un événement déjà publié ne peut pas être supprimé. Vous devez l’annuler."
              : "Cet événement ne peut plus être supprimé dans son état actuel.",
        },
        409,
      );
    }

    /*
     * Toute commande bloque la suppression, même si elle n’est
     * pas encore payée. Cela évite de casser les références de
     * paiement, les historiques et les tentatives de commande.
     */
    if (event._count.orders > 0) {
      return jsonResponse(
        {
          success: false,
          code: "EVENT_HAS_ORDERS",
          message:
            "Cet événement possède déjà une ou plusieurs commandes. Il ne peut plus être supprimé.",
        },
        409,
      );
    }

    if (event._count.tickets > 0) {
      return jsonResponse(
        {
          success: false,
          code: "EVENT_HAS_TICKETS",
          message:
            "Cet événement possède déjà des billets générés. Il ne peut plus être supprimé.",
        },
        409,
      );
    }

    const imagePaths = event.images
      .map((image) => image.path.trim())
      .filter(Boolean);

    /*
     * La suppression PostgreSQL est effectuée avant celle du
     * Storage. Cela empêche de casser l’événement si la base
     * de données refuse finalement la transaction.
     *
     * Les relations EventImage, TicketType, Coupon et
     * OrganizerActivity sont supprimées grâce aux règles
     * onDelete configurées dans Prisma.
     */
    await prisma.$transaction(
      async (transaction) => {
        const latestEvent =
          await transaction.event.findFirst({
            where: {
              id: event.id,
              organizerId: organizer.id,
            },

            select: {
              id: true,
              status: true,

              _count: {
                select: {
                  orders: true,
                  tickets: true,
                },
              },
            },
          });

        if (!latestEvent) {
          throw new DeleteEventConflictError(
            "EVENT_ALREADY_DELETED",
            "Cet événement a déjà été supprimé.",
          );
        }

        if (
          latestEvent.status !== "DRAFT" &&
          latestEvent.status !== "PENDING"
        ) {
          throw new DeleteEventConflictError(
            "EVENT_STATUS_CHANGED",
            "Le statut de l’événement a changé. Actualisez la page avant de recommencer.",
          );
        }

        if (
          latestEvent._count.orders > 0 ||
          latestEvent._count.tickets > 0
        ) {
          throw new DeleteEventConflictError(
            "EVENT_NOW_HAS_SALES",
            "Une commande ou un billet a été créé entre-temps. La suppression a été bloquée.",
          );
        }

        await transaction.event.delete({
          where: {
            id: latestEvent.id,
          },
        });
      },
      {
        maxWait: 5_000,
        timeout: 15_000,
      },
    );

    let storageWarning: string | undefined;

    if (imagePaths.length > 0) {
      try {
        await removeEventImagesFromStorage(
          imagePaths,
        );
      } catch (storageError) {
        /*
         * L’événement est déjà supprimé de PostgreSQL.
         * L’échec du nettoyage Storage ne doit donc pas transformer
         * l’opération en fausse suppression échouée.
         */
        storageWarning =
          "L’événement a été supprimé, mais certaines images n’ont pas pu être nettoyées automatiquement.";

        console.error(
          "[DELETE_EVENT_STORAGE_CLEANUP_ERROR]",
          {
            eventId: event.id,
            paths: imagePaths,
            message:
              storageError instanceof Error
                ? storageError.message
                : storageError,
          },
        );
      }
    }

    console.info(
      "[ORGANIZER_EVENT_DELETED]",
      {
        eventId: event.id,
        organizerId: organizer.id,
        title: event.title,
        deletedImages: imagePaths.length,
      },
    );

    return jsonResponse(
      {
        success: true,
        code: "EVENT_DELETED",
        message:
          "L’événement a été supprimé avec succès.",
        redirectTo: "/organizer/events",
        warning: storageWarning,

        data: {
          eventId: event.id,
          title: event.title,
        },
      },
      200,
    );
  } catch (error) {
    if (
      error instanceof
      DeleteEventConflictError
    ) {
      return jsonResponse(
        {
          success: false,
          code: error.code,
          message: error.message,
        },
        409,
      );
    }

    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return jsonResponse(
        {
          success: false,
          code: "EVENT_NOT_FOUND",
          message:
            "Cet événement est introuvable ou a déjà été supprimé.",
        },
        404,
      );
    }

    /*
     * P2003 correspond généralement à une contrainte de clé
     * étrangère encore présente. La suppression est bloquée
     * plutôt que de risquer de corrompre les données.
     */
    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return jsonResponse(
        {
          success: false,
          code: "EVENT_HAS_RELATED_DATA",
          message:
            "Cet événement contient encore des données liées et ne peut pas être supprimé.",
        },
        409,
      );
    }

    console.error(
      "[DELETE_ORGANIZER_EVENT_ERROR]",
      error instanceof Error
        ? error.message
        : error,
    );

    return jsonResponse(
      {
        success: false,
        code: "DELETE_EVENT_FAILED",
        message:
          "Impossible de supprimer l’événement pour le moment.",
      },
      500,
    );
  }
}

class DeleteEventConflictError extends Error {
  readonly code: string;

  constructor(
    code: string,
    message: string,
  ) {
    super(message);
    this.name =
      "DeleteEventConflictError";
    this.code = code;
  }
}