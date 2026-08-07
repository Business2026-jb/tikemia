import {
  createHash,
} from "node:crypto";

import {
  TicketTransferStatus,
} from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const CLIENT_SESSION_COOKIE_NAME =
  process.env.CLIENT_SESSION_COOKIE_NAME?.trim() ||
  "tikemia_client_session";

const cancelTransferSchema = z
  .object({
    reference: z
      .string()
      .trim()
      .min(
        8,
        "La référence du transfert est invalide.",
      )
      .max(
        100,
        "La référence du transfert est invalide.",
      ),
  })
  .strict();

type AuthenticatedCustomer = Readonly<{
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
}>;

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): NextResponse {
  return NextResponse.json(
    body,
    {
      status,

      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate, max-age=0",

        Pragma:
          "no-cache",

        Expires:
          "0",

        "X-Content-Type-Options":
          "nosniff",
      },
    },
  );
}

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string {
  return value?.trim() ?? "";
}

function normalizeEmail(
  value:
    | string
    | null
    | undefined,
): string {
  return normalizeText(
    value,
  ).toLowerCase();
}

function hashSessionToken(
  token: string,
): string {
  return createHash(
    "sha256",
  )
    .update(
      token,
    )
    .digest(
      "hex",
    );
}

async function getAuthenticatedCustomer():
  Promise<AuthenticatedCustomer | null> {
  const cookieStore =
    await cookies();

  const sessionToken =
    normalizeText(
      cookieStore.get(
        CLIENT_SESSION_COOKIE_NAME,
      )?.value,
    );

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
        id:
          true,

        expiresAt:
          true,

        user: {
          select: {
            id:
              true,

            firstName:
              true,

            lastName:
              true,

            email:
              true,

            phone:
              true,

            role:
              true,

            emailVerified:
              true,

            isActive:
              true,
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
          id:
            session.id,
        },
      })
      .catch(
        () =>
          undefined,
      );

    return null;
  }

  if (
    session.user.role !==
      "CUSTOMER" ||
    !session.user.emailVerified ||
    !session.user.isActive
  ) {
    return null;
  }

  const email =
    normalizeEmail(
      session.user.email,
    );

  if (!email) {
    return null;
  }

  return {
    id:
      session.user.id,

    firstName:
      normalizeText(
        session.user.firstName,
      ),

    lastName:
      normalizeText(
        session.user.lastName,
      ),

    email,

    phone:
      normalizeText(
        session.user.phone,
      ) || null,
  };
}

export async function POST(
  request: Request,
): Promise<NextResponse> {
  try {
    const customer =
      await getAuthenticatedCustomer();

    if (!customer) {
      return jsonResponse(
        {
          success:
            false,

          code:
            "UNAUTHORIZED",

          message:
            "Connectez-vous à votre compte Tikemia pour annuler ce transfert.",
        },
        401,
      );
    }

    let rawBody:
      unknown;

    try {
      rawBody =
        await request.json();
    } catch {
      return jsonResponse(
        {
          success:
            false,

          code:
            "INVALID_JSON",

          message:
            "La requête envoyée est invalide.",
        },
        400,
      );
    }

    const parsedBody =
      cancelTransferSchema.safeParse(
        rawBody,
      );

    if (!parsedBody.success) {
      return jsonResponse(
        {
          success:
            false,

          code:
            "INVALID_REQUEST",

          message:
            parsedBody.error
              .issues[0]
              ?.message ||
            "La référence du transfert est invalide.",
        },
        400,
      );
    }

    const reference =
      parsedBody.data.reference;

    const existingTransfer =
      await prisma.ticketTransfer.findUnique({
        where: {
          reference,
        },

        select: {
          id:
            true,

          reference:
            true,

          senderId:
            true,

          status:
            true,

          requestedAt:
            true,

          completedAt:
            true,

          expiredAt:
            true,

          cancelledAt:
            true,

          items: {
            select: {
              id:
                true,

              ticketId:
                true,
            },
          },
        },
      });

    if (
      !existingTransfer ||
      existingTransfer.senderId !==
        customer.id
    ) {
      return jsonResponse(
        {
          success:
            false,

          code:
            "TRANSFER_NOT_FOUND",

          message:
            "Ce transfert est introuvable ou ne vous appartient pas.",
        },
        404,
      );
    }

    if (
      existingTransfer.status ===
      TicketTransferStatus.CANCELLED
    ) {
      return jsonResponse({
        success:
          true,

        code:
          "ALREADY_CANCELLED",

        message:
          "Ce transfert a déjà été annulé.",

        transfer: {
          reference:
            existingTransfer.reference,

          status:
            existingTransfer.status,

          cancelledAt:
            existingTransfer.cancelledAt
              ?.toISOString() ??
            null,

          releasedTicketsCount:
            existingTransfer.items.length,
        },
      });
    }

    if (
      existingTransfer.status ===
      TicketTransferStatus.COMPLETED
    ) {
      return jsonResponse(
        {
          success:
            false,

          code:
            "TRANSFER_ALREADY_COMPLETED",

          message:
            "Ce transfert est déjà terminé et ne peut plus être annulé.",
        },
        409,
      );
    }

    if (
      existingTransfer.status ===
      TicketTransferStatus.PROCESSING
    ) {
      return jsonResponse(
        {
          success:
            false,

          code:
            "TRANSFER_PROCESSING",

          message:
            "Ce transfert est en cours de traitement et ne peut plus être annulé.",
        },
        409,
      );
    }

    if (
      existingTransfer.status !==
      TicketTransferStatus.PENDING_VERIFICATION
    ) {
      return jsonResponse(
        {
          success:
            false,

          code:
            "TRANSFER_NOT_CANCELLABLE",

          message:
            "Ce transfert ne peut plus être annulé.",
        },
        409,
      );
    }

    const cancelledAt =
      new Date();

    const cancelledTransfer =
      await prisma.$transaction(
        async (
          transaction,
        ) => {
          const cancellation =
            await transaction.ticketTransfer.updateMany({
              where: {
                id:
                  existingTransfer.id,

                senderId:
                  customer.id,

                status:
                  TicketTransferStatus.PENDING_VERIFICATION,
              },

              data: {
                status:
                  TicketTransferStatus.CANCELLED,

                cancelledAt,

                failedAt:
                  null,

                expiredAt:
                  null,

                failureReason:
                  "Transfert annulé par l’expéditeur.",
              },
            });

          if (
            cancellation.count !==
            1
          ) {
            throw new Error(
              "TRANSFER_STATUS_CHANGED",
            );
          }

          return transaction.ticketTransfer.findUnique({
            where: {
              id:
                existingTransfer.id,
            },

            select: {
              id:
                true,

              reference:
                true,

              status:
                true,

              cancelledAt:
                true,

              items: {
                select: {
                  id:
                    true,

                  ticketId:
                    true,
                },
              },
            },
          });
        },
      );

    if (!cancelledTransfer) {
      throw new Error(
        "TRANSFER_CANCELLATION_FAILED",
      );
    }

    /*
     * Les TicketTransferItem sont volontairement conservés.
     *
     * Ils permettent de garder l’historique du transfert.
     * Comme le TicketTransfer n’est plus PENDING_VERIFICATION
     * ou PROCESSING, la route des options ne bloque plus
     * les billets correspondants.
     */

    return jsonResponse({
      success:
        true,

      code:
        "TRANSFER_CANCELLED",

      message:
        "Le transfert a été annulé. Les billets sont de nouveau disponibles.",

      transfer: {
        reference:
          cancelledTransfer.reference,

        status:
          cancelledTransfer.status,

        cancelledAt:
          cancelledTransfer.cancelledAt
            ?.toISOString() ??
          cancelledAt.toISOString(),

        releasedTicketsCount:
          cancelledTransfer.items.length,

        releasedTicketIds:
          cancelledTransfer.items.map(
            (
              item,
            ) =>
              item.ticketId,
          ),
      },
    });
  } catch (error) {
    console.error(
      "[CLIENT_TRANSFER_CANCEL_ERROR]",
      error instanceof Error
        ? {
            name:
              error.name,

            message:
              error.message,

            stack:
              process.env.NODE_ENV ===
              "development"
                ? error.stack
                : undefined,
          }
        : error,
    );

    if (
      error instanceof Error &&
      error.message ===
        "TRANSFER_STATUS_CHANGED"
    ) {
      return jsonResponse(
        {
          success:
            false,

          code:
            "TRANSFER_STATUS_CHANGED",

          message:
            "Le statut du transfert a changé. Actualisez la page et réessayez.",
        },
        409,
      );
    }

    if (
      error instanceof Error &&
      error.message ===
        "TRANSFER_CANCELLATION_FAILED"
    ) {
      return jsonResponse(
        {
          success:
            false,

          code:
            "TRANSFER_CANCELLATION_FAILED",

          message:
            "Le transfert n’a pas pu être annulé.",
        },
        500,
      );
    }

    return jsonResponse(
      {
        success:
          false,

        code:
          "INTERNAL_ERROR",

        message:
          "Impossible d’annuler le transfert pour le moment. Réessayez.",
      },
      500,
    );
  }
}