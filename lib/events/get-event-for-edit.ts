import "server-only";

import { createHash } from "node:crypto";

import {
  type EventStatus,
  Prisma,
} from "@prisma/client";
import { cookies } from "next/headers";

import {
  getCreateEventOptions,
} from "@/lib/events/get-create-event-options";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE_FALLBACK_NAME =
  "tikemia_session";

const EDITABLE_EVENT_STATUSES: readonly EventStatus[] = [
  "DRAFT",
  "PENDING",
  "PUBLISHED",
  "SUSPENDED",
];

type CreateEventOptions = Awaited<
  ReturnType<typeof getCreateEventOptions>
>;

export type EventForEditImage = {
  id: string;
  path: string;
  publicUrl: string;
  position: number;
  isCover: boolean;
  createdAt: string;
};

export type EventForEditTicketType = {
  id: string;
  name: string;
  description: string;
  price: number;
  quantity: number;
  maxPerOrder: number;
  saleStartsAt: string | null;
  saleEndsAt: string | null;
  saleStartsAtInput: string;
  saleEndsAtInput: string;
  isActive: boolean;
  soldCount: number;
  remainingCount: number;
  createdAt: string;
  updatedAt: string;
};

export type EventForEditData = {
  id: string;
  organizerId: string;
  categoryId: string | null;

  title: string;
  slug: string;
  description: string;
  coverImage: string | null;

  venueName: string;
  address: string;
  city: string;
  country: string;
  countryCode: string;
  timezone: string;

  startsAt: string;
  endsAt: string | null;
  salesStartAt: string | null;
  salesEndAt: string | null;

  startsAtInput: string;
  endsAtInput: string;
  salesStartAtInput: string;
  salesEndAtInput: string;

  currency: string;
  platformFeePercent: number;
  capacity: number;
  status: EventStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;

  category: {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
  } | null;

  images: EventForEditImage[];
  ticketTypes: EventForEditTicketType[];

  totals: {
    ticketTypesCount: number;
    ticketsSold: number;
    placesRemaining: number;
    paidOrdersCount: number;
    grossRevenue: number;
    platformFee: number;
    organizerNetRevenue: number;
  };

  permissions: {
    canEdit: boolean;
    canEditImages: boolean;
    canEditTicketTypes: boolean;
    canReduceCapacity: boolean;
    canSubmitForValidation: boolean;
    canPublishDirectly: boolean;
  };
};

export type GetEventForEditResult = {
  organizer: {
    id: string;
    firstName: string;
    lastName: string;
    displayName: string;
    businessName: string | null;
  };

  event: EventForEditData;
  options: CreateEventOptions;
};

export class GetEventForEditError extends Error {
  readonly code: string;
  readonly status: number;
  readonly redirectTo?: string;

  constructor({
    code,
    message,
    status = 500,
    redirectTo,
  }: {
    code: string;
    message: string;
    status?: number;
    redirectTo?: string;
  }) {
    super(message);

    this.name = "GetEventForEditError";
    this.code = code;
    this.status = status;
    this.redirectTo = redirectTo;
  }
}

function hashSessionToken(
  token: string,
): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

function decimalToNumber(
  value:
    | Prisma.Decimal
    | number
    | string
    | null
    | undefined,
): number {
  if (
    value === null ||
    value === undefined
  ) {
    return 0;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue)
    ? numberValue
    : 0;
}

function normalizeEventId(
  value: string,
): string {
  return value.trim();
}

/**
 * Transforme une date UTC venant de PostgreSQL en valeur compatible
 * avec un champ HTML datetime-local dans le fuseau de l’événement.
 *
 * Exemple retourné :
 * 2026-07-15T20:30
 */
function toDateTimeLocalInput(
  value: Date | null,
  timezone: string,
): string {
  if (!value) {
    return "";
  }

  try {
    const parts =
      new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(value);

    const values = new Map(
      parts.map((part) => [
        part.type,
        part.value,
      ]),
    );

    const year = values.get("year");
    const month = values.get("month");
    const day = values.get("day");
    const hour = values.get("hour");
    const minute = values.get("minute");

    if (
      !year ||
      !month ||
      !day ||
      !hour ||
      !minute
    ) {
      return "";
    }

    return `${year}-${month}-${day}T${hour}:${minute}`;
  } catch {
    const year = value
      .getFullYear()
      .toString()
      .padStart(4, "0");

    const month = String(
      value.getMonth() + 1,
    ).padStart(2, "0");

    const day = String(
      value.getDate(),
    ).padStart(2, "0");

    const hour = String(
      value.getHours(),
    ).padStart(2, "0");

    const minute = String(
      value.getMinutes(),
    ).padStart(2, "0");

    return `${year}-${month}-${day}T${hour}:${minute}`;
  }
}

async function getAuthenticatedOrganizer() {
  const cookieStore = await cookies();

  const sessionCookieName =
    process.env.SESSION_COOKIE_NAME?.trim() ||
    SESSION_COOKIE_FALLBACK_NAME;

  const sessionToken =
    cookieStore.get(
      sessionCookieName,
    )?.value;

  if (!sessionToken) {
    throw new GetEventForEditError({
      code: "UNAUTHORIZED",
      status: 401,
      message:
        "Votre session est absente ou expirée.",
      redirectTo: "/organizer/login",
    });
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
            firstName: true,
            lastName: true,
            role: true,
            emailVerified: true,
            isActive: true,

            organizerProfile: {
              select: {
                businessName: true,
              },
            },
          },
        },
      },
    });

  if (!session) {
    throw new GetEventForEditError({
      code: "INVALID_SESSION",
      status: 401,
      message:
        "Votre session n’est plus valide.",
      redirectTo: "/organizer/login",
    });
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
          "[GET_EVENT_FOR_EDIT_EXPIRED_SESSION_DELETE_ERROR]",
          error instanceof Error
            ? error.message
            : error,
        );
      });

    throw new GetEventForEditError({
      code: "EXPIRED_SESSION",
      status: 401,
      message:
        "Votre session a expiré. Reconnectez-vous.",
      redirectTo: "/organizer/login",
    });
  }

  if (
    session.user.role !==
      "ORGANIZER" ||
    !session.user.emailVerified ||
    !session.user.isActive
  ) {
    throw new GetEventForEditError({
      code: "FORBIDDEN",
      status: 403,
      message:
        "Votre compte organisateur ne peut pas modifier cet événement.",
      redirectTo:
        "/organizer/dashboard",
    });
  }

  return session.user;
}

function ensureEventIsEditable(
  status: EventStatus,
): void {
  if (
    EDITABLE_EVENT_STATUSES.includes(
      status,
    )
  ) {
    return;
  }

  if (status === "CANCELLED") {
    throw new GetEventForEditError({
      code: "CANCELLED_EVENT_NOT_EDITABLE",
      status: 409,
      message:
        "Un événement annulé ne peut plus être modifié.",
    });
  }

  if (status === "COMPLETED") {
    throw new GetEventForEditError({
      code: "COMPLETED_EVENT_NOT_EDITABLE",
      status: 409,
      message:
        "Un événement terminé ne peut plus être modifié.",
    });
  }

  throw new GetEventForEditError({
    code: "EVENT_NOT_EDITABLE",
    status: 409,
    message:
      "Cet événement ne peut pas être modifié dans son état actuel.",
  });
}

export async function getEventForEdit(
  rawEventId: string,
): Promise<GetEventForEditResult> {
  try {
    const eventId =
      normalizeEventId(rawEventId);

    if (!eventId) {
      throw new GetEventForEditError({
        code: "INVALID_EVENT_ID",
        status: 400,
        message:
          "L’identifiant de l’événement est invalide.",
      });
    }

    const organizer =
      await getAuthenticatedOrganizer();

    const [event, options] =
      await Promise.all([
        prisma.event.findFirst({
          where: {
            id: eventId,
            organizerId: organizer.id,
          },

          select: {
            id: true,
            organizerId: true,
            categoryId: true,

            title: true,
            slug: true,
            description: true,
            coverImage: true,

            venueName: true,
            address: true,
            city: true,
            country: true,
            countryCode: true,
            timezone: true,

            startsAt: true,
            endsAt: true,
            salesStartAt: true,
            salesEndAt: true,

            currency: true,
            platformFeeRate: true,
            capacity: true,
            status: true,
            publishedAt: true,
            createdAt: true,
            updatedAt: true,

            category: {
              select: {
                id: true,
                name: true,
                slug: true,
                icon: true,
              },
            },

            images: {
              orderBy: {
                position: "asc",
              },

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
          },
        }),

        getCreateEventOptions(),
      ]);

    if (!event) {
      throw new GetEventForEditError({
        code: "EVENT_NOT_FOUND",
        status: 404,
        message:
          "Cet événement est introuvable ou ne vous appartient pas.",
      });
    }

    ensureEventIsEditable(
      event.status,
    );

    const ticketTypeIds =
      event.ticketTypes.map(
        (ticketType) =>
          ticketType.id,
      );

    const [
      soldTicketsGrouped,
      paidOrders,
    ] = await Promise.all([
      ticketTypeIds.length > 0
        ? prisma.ticket.groupBy({
            by: ["ticketTypeId"],

            where: {
              eventId: event.id,

              ticketTypeId: {
                in: ticketTypeIds,
              },

              status: {
                in: [
                  "VALID",
                  "USED",
                ],
              },
            },

            _count: {
              _all: true,
            },
          })
        : Promise.resolve([]),

      prisma.order.aggregate({
        where: {
          eventId: event.id,
          status: "PAID",
        },

        _count: {
          _all: true,
        },

        _sum: {
          subtotal: true,
          platformFee: true,
        },
      }),
    ]);

    const soldCountByTicketType =
      new Map(
        soldTicketsGrouped.map(
          (item) => [
            item.ticketTypeId,
            item._count._all,
          ],
        ),
      );

    const ticketTypes:
      EventForEditTicketType[] =
      event.ticketTypes.map(
        (ticketType) => {
          const soldCount =
            soldCountByTicketType.get(
              ticketType.id,
            ) ?? 0;

          return {
            id: ticketType.id,
            name: ticketType.name,

            description:
              ticketType.description ??
              "",

            price:
              decimalToNumber(
                ticketType.price,
              ),

            quantity:
              ticketType.quantity,

            maxPerOrder:
              ticketType.maxPerOrder,

            saleStartsAt:
              ticketType.saleStartsAt
                ?.toISOString() ??
              null,

            saleEndsAt:
              ticketType.saleEndsAt
                ?.toISOString() ??
              null,

            saleStartsAtInput:
              toDateTimeLocalInput(
                ticketType.saleStartsAt,
                event.timezone,
              ),

            saleEndsAtInput:
              toDateTimeLocalInput(
                ticketType.saleEndsAt,
                event.timezone,
              ),

            isActive:
              ticketType.isActive,

            soldCount,

            remainingCount:
              Math.max(
                ticketType.quantity -
                  soldCount,
                0,
              ),

            createdAt:
              ticketType.createdAt
                .toISOString(),

            updatedAt:
              ticketType.updatedAt
                .toISOString(),
          };
        },
      );

    const totalTicketsSold =
      ticketTypes.reduce(
        (total, ticketType) =>
          total +
          ticketType.soldCount,
        0,
      );

    const grossRevenue =
      decimalToNumber(
        paidOrders._sum.subtotal,
      );

    const platformFee =
      decimalToNumber(
        paidOrders._sum.platformFee,
      );

    const organizerNetRevenue =
      grossRevenue -
      platformFee;

    const firstName =
      organizer.firstName.trim();

    const lastName =
      organizer.lastName.trim();

    const businessName =
      organizer.organizerProfile
        ?.businessName?.trim() ||
      null;

    const hasSales =
      totalTicketsSold > 0 ||
      paidOrders._count._all > 0;

    return {
      organizer: {
        id: organizer.id,
        firstName,
        lastName,

        displayName:
          businessName ||
          `${firstName} ${lastName}`.trim(),

        businessName,
      },

      options,

      event: {
        id: event.id,
        organizerId:
          event.organizerId,

        categoryId:
          event.categoryId,

        title: event.title,
        slug: event.slug,

        description:
          event.description,

        coverImage:
          event.coverImage,

        venueName:
          event.venueName,

        address: event.address,
        city: event.city,
        country: event.country,

        countryCode:
          event.countryCode,

        timezone:
          event.timezone,

        startsAt:
          event.startsAt.toISOString(),

        endsAt:
          event.endsAt?.toISOString() ??
          null,

        salesStartAt:
          event.salesStartAt
            ?.toISOString() ??
          null,

        salesEndAt:
          event.salesEndAt
            ?.toISOString() ??
          null,

        startsAtInput:
          toDateTimeLocalInput(
            event.startsAt,
            event.timezone,
          ),

        endsAtInput:
          toDateTimeLocalInput(
            event.endsAt,
            event.timezone,
          ),

        salesStartAtInput:
          toDateTimeLocalInput(
            event.salesStartAt,
            event.timezone,
          ),

        salesEndAtInput:
          toDateTimeLocalInput(
            event.salesEndAt,
            event.timezone,
          ),

        currency:
          event.currency,

        platformFeePercent:
          decimalToNumber(
            event.platformFeeRate,
          ),

        capacity:
          event.capacity,

        status: event.status,

        publishedAt:
          event.publishedAt
            ?.toISOString() ??
          null,

        createdAt:
          event.createdAt.toISOString(),

        updatedAt:
          event.updatedAt.toISOString(),

        category:
          event.category,

        images:
          event.images.map(
            (image) => ({
              id: image.id,
              path: image.path,

              publicUrl:
                image.publicUrl,

              position:
                image.position,

              isCover:
                image.isCover,

              createdAt:
                image.createdAt
                  .toISOString(),
            }),
          ),

        ticketTypes,

        totals: {
          ticketTypesCount:
            ticketTypes.length,

          ticketsSold:
            totalTicketsSold,

          placesRemaining:
            Math.max(
              event.capacity -
                totalTicketsSold,
              0,
            ),

          paidOrdersCount:
            paidOrders._count._all,

          grossRevenue,
          platformFee,
          organizerNetRevenue,
        },

        permissions: {
          canEdit: true,

          canEditImages: true,

          /*
           * Les types de billets peuvent être modifiés,
           * mais le futur service update-event.ts empêchera
           * toute réduction sous le nombre déjà vendu.
           */
          canEditTicketTypes: true,

          canReduceCapacity:
            !hasSales,

          canSubmitForValidation:
            event.status ===
            "DRAFT",

          /*
           * Un organisateur ne publie jamais directement.
           * La publication reste réservée à l’administration.
           */
          canPublishDirectly:
            false,
        },
      },
    };
  } catch (error) {
    if (
      error instanceof
      GetEventForEditError
    ) {
      throw error;
    }

    console.error(
      "[GET_EVENT_FOR_EDIT_ERROR]",
      error instanceof Error
        ? error.message
        : error,
    );

    throw new GetEventForEditError({
      code:
        "GET_EVENT_FOR_EDIT_FAILED",

      status: 500,

      message:
        "Impossible de charger cet événement pour modification.",
    });
  }
}