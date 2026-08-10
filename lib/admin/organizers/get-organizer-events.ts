import "server-only";

import {
  EventStatus,
  OrderStatus,
  Prisma,
  UserRole,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type GetOrganizerEventsInput = {
  organizerId: string;
  search?: string | null;
  status?: EventStatus | "all";
  page?: number;
  pageSize?: number;
};

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 50;

function positiveInteger(
  value: number | undefined,
  fallback: number,
): number {
  return Number.isInteger(value) && Number(value) > 0
    ? Number(value)
    : fallback;
}

export async function getOrganizerEvents(
  input: GetOrganizerEventsInput,
) {
  const organizerId = input.organizerId.trim();

  if (!organizerId) {
    throw new Error("Organizer id is required.");
  }

  const organizer = await prisma.user.findFirst({
    where: {
      id: organizerId,
      role: UserRole.ORGANIZER,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      isActive: true,
      organizerProfile: {
        select: {
          businessName: true,
          logo: true,
          avatar: true,
          hasBlueBadge: true,
        },
      },
    },
  });

  if (!organizer) {
    throw new Error("Organizer not found.");
  }

  const search = input.search?.trim() ?? "";
  const page = positiveInteger(input.page, DEFAULT_PAGE);
  const pageSize = Math.min(
    positiveInteger(input.pageSize, DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );

  const where: Prisma.EventWhereInput = {
    organizerId,
  };

  if (input.status && input.status !== "all") {
    where.status = input.status;
  }

  if (search) {
    where.OR = [
      {
        title: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        venueName: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        city: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        country: {
          contains: search,
          mode: "insensitive",
        },
      },
    ];
  }

  const [totalItems, events] =
    await prisma.$transaction([
      prisma.event.count({ where }),
      prisma.event.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [
          { startsAt: "desc" },
          { createdAt: "desc" },
        ],
        select: {
          id: true,
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
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          ticketTypes: {
            orderBy: { price: "asc" },
            select: {
              id: true,
              name: true,
              description: true,
              price: true,
              quantity: true,
              sold: true,
              reserved: true,
              maxPerOrder: true,
              saleStartsAt: true,
              saleEndsAt: true,
              isActive: true,
              isTransferable: true,
            },
          },
          _count: {
            select: {
              orders: true,
              tickets: true,
              eventFavorites: true,
              scannerAssignments: true,
              moderationLogs: true,
              boosts: true,
            },
          },
        },
      }),
    ]);

  const eventIds = events.map((event) => event.id);

  const paidOrders =
    eventIds.length === 0
      ? []
      : await prisma.order.groupBy({
          by: ["eventId"],
          where: {
            eventId: { in: eventIds },
            status: OrderStatus.PAID,
          },
          _count: { _all: true },
          _sum: {
            subtotal: true,
            platformFee: true,
            total: true,
          },
        });

  const paidByEvent = new Map(
    paidOrders.map((group) => [
      group.eventId,
      {
        count: group._count._all,
        subtotal:
          group._sum.subtotal?.toFixed(2) ?? "0.00",
        platformFee:
          group._sum.platformFee?.toFixed(2) ?? "0.00",
        total: group._sum.total?.toFixed(2) ?? "0.00",
      },
    ]),
  );

  const totalPages =
    totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);

  return {
    organizer: {
      id: organizer.id,
      fullName:
        `${organizer.firstName} ${organizer.lastName}`.trim(),
      email: organizer.email,
      isActive: organizer.isActive,
      profile: organizer.organizerProfile,
    },
    events: events.map((event) => {
      const paid = paidByEvent.get(event.id);

      return {
        ...event,
        latitude: event.latitude?.toString() ?? null,
        longitude: event.longitude?.toString() ?? null,
        platformFeeRate: event.platformFeeRate.toFixed(2),
        ticketTypes: event.ticketTypes.map(
          (ticketType) => ({
            ...ticketType,
            price: ticketType.price.toFixed(2),
            available: Math.max(
              ticketType.quantity -
                ticketType.sold -
                ticketType.reserved,
              0,
            ),
          }),
        ),
        statistics: {
          orders: event._count.orders,
          paidOrders: paid?.count ?? 0,
          tickets: event._count.tickets,
          favorites: event._count.eventFavorites,
          scanners: event._count.scannerAssignments,
          moderationLogs: event._count.moderationLogs,
          boosts: event._count.boosts,
          paidSubtotal: paid?.subtotal ?? "0.00",
          platformFees: paid?.platformFee ?? "0.00",
          paidRevenue: paid?.total ?? "0.00",
        },
      };
    }),
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
      hasPreviousPage: page > 1,
      hasNextPage: page < totalPages,
    },
  };
}
