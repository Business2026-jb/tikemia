import { createHash } from "node:crypto";

import { Prisma, TicketStatus, TicketTransferStatus } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CLIENT_SESSION_COOKIE_NAME =
  process.env.CLIENT_SESSION_COOKIE_NAME?.trim() ||
  "tikemia_client_session";

const ACTIVE_TRANSFER_STATUSES: TicketTransferStatus[] = [
  TicketTransferStatus.PENDING_VERIFICATION,
  TicketTransferStatus.PROCESSING,
];

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

function formatDecimal(
  value: Prisma.Decimal,
): string {
  return value.toFixed(2);
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
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
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
          id:
            session.id,
        },
      })
      .catch(() => undefined);

    return null;
  }

  const customer =
    session.user;

  if (
    customer.role !==
      "CUSTOMER" ||
    !customer.emailVerified ||
    !customer.isActive
  ) {
    return null;
  }

  return customer;
}

export async function GET() {
  try {
    const customer =
      await getAuthenticatedCustomer();

    if (!customer) {
      return jsonResponse(
        {
          success: false,
          code: "UNAUTHORIZED",
          message:
            "Connectez-vous à votre compte Tikemia pour consulter vos billets transférables.",
        },
        401,
      );
    }

    const now =
      new Date();

    const ticketWhere: Prisma.TicketWhereInput = {
      status:
        TicketStatus.VALID,

      ownerId:
        customer.id,

      event: {
        status:
          "PUBLISHED",

        startsAt: {
          gt:
            now,
        },

        organizer: {
          organizerSettings: {
            is: {
              allowTicketTransfer:
                true,
            },
          },
        },
      },

      transferItems: {
        none: {
          transfer: {
            status: {
              in:
                ACTIVE_TRANSFER_STATUSES,
            },
          },
        },
      },
    };

    const tickets =
      await prisma.ticket.findMany({
        where:
          ticketWhere,

        orderBy: [
          {
            event: {
              startsAt:
                "asc",
            },
          },
          {
            ticketType: {
              name:
                "asc",
            },
          },
          {
            createdAt:
              "asc",
          },
        ],

        select: {
          id: true,
          code: true,
          status: true,
          holderName: true,
          holderEmail: true,
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
              endsAt: true,
              currency: true,

              organizer: {
                select: {
                  organizerSettings: {
                    select: {
                      allowTicketTransfer:
                        true,
                    },
                  },
                },
              },
            },
          },

          ticketType: {
            select: {
              id: true,
              name: true,
              description: true,
              price: true,
            },
          },
        },
      });

    const eventsMap =
      new Map<
        string,
        {
          id: string;
          slug: string;
          title: string;
          coverImage: string | null;
          venueName: string;
          city: string;
          country: string;
          startsAt: string;
          endsAt: string | null;
          currency: string;
          transferableTicketsCount: number;
          categories: Map<
            string,
            {
              ticketTypeId: string;
              name: string;
              description: string | null;
              unitPrice: string;
              availableQuantity: number;
              tickets: Array<{
                id: string;
                code: string;
                holderName: string;
                holderEmail: string;
                purchasedAt: string;
              }>;
            }
          >;
        }
      >();

    for (const ticket of tickets) {
      const eventId =
        ticket.event.id;

      let eventEntry =
        eventsMap.get(
          eventId,
        );

      if (!eventEntry) {
        eventEntry = {
          id:
            ticket.event.id,

          slug:
            ticket.event.slug,

          title:
            ticket.event.title,

          coverImage:
            ticket.event.coverImage,

          venueName:
            ticket.event.venueName,

          city:
            ticket.event.city,

          country:
            ticket.event.country,

          startsAt:
            ticket.event.startsAt.toISOString(),

          endsAt:
            ticket.event.endsAt?.toISOString() ??
            null,

          currency:
            ticket.event.currency,

          transferableTicketsCount:
            0,

          categories:
            new Map(),
        };

        eventsMap.set(
          eventId,
          eventEntry,
        );
      }

      eventEntry.transferableTicketsCount +=
        1;

      const ticketTypeId =
        ticket.ticketType.id;

      let categoryEntry =
        eventEntry.categories.get(
          ticketTypeId,
        );

      if (!categoryEntry) {
        categoryEntry = {
          ticketTypeId,
          name:
            ticket.ticketType.name,

          description:
            ticket.ticketType.description,

          unitPrice:
            formatDecimal(
              ticket.ticketType.price,
            ),

          availableQuantity:
            0,

          tickets:
            [],
        };

        eventEntry.categories.set(
          ticketTypeId,
          categoryEntry,
        );
      }

      categoryEntry.availableQuantity +=
        1;

      categoryEntry.tickets.push({
        id:
          ticket.id,

        code:
          ticket.code,

        holderName:
          ticket.holderName,

        holderEmail:
          ticket.holderEmail,

        purchasedAt:
          ticket.createdAt.toISOString(),
      });
    }

    const events =
      Array.from(
        eventsMap.values(),
      ).map(
        ({
          categories,
          ...event
        }) => ({
          ...event,

          categories:
            Array.from(
              categories.values(),
            ),
        }),
      );

    return jsonResponse({
      success: true,

      message:
        events.length > 0
          ? "Billets transférables chargés."
          : "Aucun billet transférable n’est disponible.",

      summary: {
        eventsCount:
          events.length,

        ticketsCount:
          tickets.length,
      },

      events,
    });
  } catch (error) {
    console.error(
      "[CLIENT_TRANSFER_OPTIONS_ERROR]",
      error,
    );

    return jsonResponse(
      {
        success: false,
        code: "INTERNAL_ERROR",
        message:
          "Impossible de charger les billets transférables pour le moment. Réessayez.",
      },
      500,
    );
  }
}