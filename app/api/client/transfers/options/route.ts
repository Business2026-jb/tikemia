import {
  createHash,
} from "node:crypto";

import {
  Prisma,
  TicketStatus,
  TicketTransferStatus,
  UserRole,
} from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_CLIENT_SESSION_COOKIE_NAME =
  "tikemia_client_session";

const LEGACY_SESSION_COOKIE_NAME =
  "tikemia_session";

const ACTIVE_TRANSFER_STATUSES:
  TicketTransferStatus[] = [
  TicketTransferStatus.PENDING_VERIFICATION,
  TicketTransferStatus.PROCESSING,
];

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
  return NextResponse.json(body, {
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
  });
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
    .update(token)
    .digest("hex");
}

function formatDecimal(
  value: Prisma.Decimal,
): string {
  return value.toFixed(2);
}

function getSessionCookieNames():
  string[] {
  return Array.from(
    new Set(
      [
        normalizeText(
          process.env
            .CLIENT_SESSION_COOKIE_NAME,
        ),

        normalizeText(
          process.env
            .SESSION_COOKIE_NAME,
        ),

        DEFAULT_CLIENT_SESSION_COOKIE_NAME,
        LEGACY_SESSION_COOKIE_NAME,
      ].filter(Boolean),
    ),
  );
}

async function getAuthenticatedCustomer():
  Promise<AuthenticatedCustomer | null> {
  const cookieStore =
    await cookies();

  let sessionToken = "";

  for (
    const cookieName of
    getSessionCookieNames()
  ) {
    const cookieValue =
      normalizeText(
        cookieStore.get(
          cookieName,
        )?.value,
      );

    if (cookieValue) {
      sessionToken =
        cookieValue;

      break;
    }
  }

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
      UserRole.CUSTOMER ||
    !customer.emailVerified ||
    !customer.isActive
  ) {
    return null;
  }

  const email =
    normalizeEmail(
      customer.email,
    );

  if (!email) {
    return null;
  }

  return {
    id:
      customer.id,

    firstName:
      normalizeText(
        customer.firstName,
      ),

    lastName:
      normalizeText(
        customer.lastName,
      ),

    email,

    phone:
      normalizeText(
        customer.phone,
      ) || null,
  };
}

export async function GET():
  Promise<NextResponse> {
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
            "Connectez-vous à votre compte Tikemia pour consulter vos billets transférables.",
        },
        401,
      );
    }

    const now =
      new Date();

    /*
     * Un billet est considéré comme appartenant au client si :
     *
     * 1. ownerId correspond directement au compte ;
     * ou
     * 2. holderEmail correspond à l’adresse du compte.
     *
     * Le deuxième cas couvre notamment :
     * - les commandes invitées rattachées plus tard au compte ;
     * - les anciens billets générés avant la liaison ownerId ;
     * - les billets dont le propriétaire est connu par e-mail.
     */
    const ownershipFilter:
      Prisma.TicketWhereInput = {
      OR: [
        {
          ownerId:
            customer.id,
        },

        {
          holderEmail: {
            equals:
              customer.email,

            mode:
              "insensitive",
          },
        },
      ],
    };

    const ticketWhere:
      Prisma.TicketWhereInput = {
      AND: [
        ownershipFilter,

        {
          status:
            TicketStatus.VALID,
        },

        {
          event: {
            status:
              "PUBLISHED",

            startsAt: {
              gt:
                now,
            },
          },
        },

        {
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
        },
      ],
    };

    const foundTickets =
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
          ownerId: true,
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

    /*
     * Si aucune ligne OrganizerSettings n’existe encore,
     * le transfert reste autorisé par défaut.
     *
     * Le billet est exclu uniquement lorsque l’organisateur
     * a explicitement défini allowTicketTransfer à false.
     */
    const tickets =
      foundTickets.filter(
        (ticket) =>
          ticket.event.organizer
            .organizerSettings
            ?.allowTicketTransfer !==
          false,
      );

    const eventsMap =
      new Map<
        string,
        {
          id: string;
          slug: string;
          title: string;
          coverImage:
            string | null;
          venueName: string;
          city: string;
          country: string;
          startsAt: string;
          endsAt:
            string | null;
          currency: string;
          transferableTicketsCount:
            number;

          categories: Map<
            string,
            {
              ticketTypeId:
                string;
              name:
                string;
              description:
                string | null;
              unitPrice:
                string;
              availableQuantity:
                number;

              tickets: Array<{
                id:
                  string;
                code:
                  string;
                holderName:
                  string;
                holderEmail:
                  string;
                purchasedAt:
                  string;
              }>;
            }
          >;
        }
      >();

    for (
      const ticket of tickets
    ) {
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
            ticket.event.endsAt
              ?.toISOString() ??
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

      eventEntry
        .transferableTicketsCount +=
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
            ticket.ticketType
              .description,

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

      categoryEntry
        .availableQuantity +=
        1;

      categoryEntry.tickets.push({
        id:
          ticket.id,

        code:
          ticket.code,

        holderName:
          normalizeText(
            ticket.holderName,
          ) ||
          `${customer.firstName} ${customer.lastName}`
            .replace(
              /\s+/g,
              " ",
            )
            .trim(),

        holderEmail:
          normalizeEmail(
            ticket.holderEmail,
          ) ||
          customer.email,

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
      success:
        true,

      code:
        events.length > 0
          ? "TRANSFER_OPTIONS_LOADED"
          : "NO_TRANSFERABLE_TICKETS",

      message:
        events.length > 0
          ? "Billets transférables chargés."
          : "Aucun billet transférable n’est disponible.",

      summary: {
        eventsCount:
          events.length,

        ticketsCount:
          tickets.length,

        excludedByOrganizer:
          foundTickets.length -
          tickets.length,
      },

      events,
    });
  } catch (error) {
    console.error(
      "[CLIENT_TRANSFER_OPTIONS_ERROR]",
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

    return jsonResponse(
      {
        success:
          false,

        code:
          "INTERNAL_ERROR",

        message:
          "Impossible de charger les billets transférables pour le moment. Réessayez.",
      },
      500,
    );
  }
}