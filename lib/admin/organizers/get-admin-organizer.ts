import "server-only";

import {
  EventStatus,
  OrderStatus,
  PayoutStatus,
  Prisma,
  UserRole,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

export class AdminOrganizerNotFoundError extends Error {
  constructor() {
    super("Organizer not found.");
    this.name = "AdminOrganizerNotFoundError";
  }
}

export async function getAdminOrganizer(
  organizerId: string,
) {
  const id = organizerId.trim();

  if (!id) {
    throw new AdminOrganizerNotFoundError();
  }

  const organizer = await prisma.user.findFirst({
    where: {
      id,
      role: UserRole.ORGANIZER,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      country: true,
      countryCode: true,
      dialCode: true,
      emailVerified: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      organizerProfile: true,
      organizerSettings: true,
      organizerSubscriptions: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          plan: true,
          payments: {
            orderBy: { createdAt: "desc" },
            take: 5,
          },
        },
      },
      payoutDestinations: {
        orderBy: [
          { isDefault: "desc" },
          { createdAt: "desc" },
        ],
        select: {
          id: true,
          type: true,
          status: true,
          country: true,
          countryCode: true,
          currency: true,
          accountName: true,
          mobileProvider: true,
          phoneNumberLast4: true,
          bankName: true,
          bankAccountNumberLast4: true,
          ibanLast4: true,
          swiftBic: true,
          cryptoNetwork: true,
          cryptoAddressLast6: true,
          isDefault: true,
          isActive: true,
          verifiedAt: true,
          rejectedAt: true,
          rejectionReason: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      organizerActivities: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          eventId: true,
          type: true,
          title: true,
          description: true,
          amount: true,
          currency: true,
          metadata: true,
          createdAt: true,
        },
      },
      organizerEvents: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          title: true,
          slug: true,
          coverImage: true,
          venueName: true,
          city: true,
          country: true,
          startsAt: true,
          endsAt: true,
          status: true,
          currency: true,
          capacity: true,
          isFeatured: true,
          publishedAt: true,
          createdAt: true,
          _count: {
            select: {
              ticketTypes: true,
              orders: true,
              tickets: true,
            },
          },
        },
      },
    },
  });

  if (!organizer) {
    throw new AdminOrganizerNotFoundError();
  }

  const [
    eventStatusGroups,
    totalOrders,
    paidOrders,
    totalTickets,
    revenue,
    payoutStatusGroups,
  ] = await Promise.all([
    prisma.event.groupBy({
      by: ["status"],
      where: { organizerId: organizer.id },
      _count: { _all: true },
    }),
    prisma.order.count({
      where: {
        event: { organizerId: organizer.id },
      },
    }),
    prisma.order.count({
      where: {
        status: OrderStatus.PAID,
        event: { organizerId: organizer.id },
      },
    }),
    prisma.ticket.count({
      where: {
        event: { organizerId: organizer.id },
      },
    }),
    prisma.order.aggregate({
      where: {
        status: OrderStatus.PAID,
        event: { organizerId: organizer.id },
      },
      _sum: {
        subtotal: true,
        platformFee: true,
        total: true,
      },
    }),
    prisma.payout.groupBy({
      by: ["status"],
      where: { organizerId: organizer.id },
      _count: { _all: true },
      _sum: {
        amount: true,
        fee: true,
        netAmount: true,
      },
    }),
  ]);

  const eventCounts = Object.fromEntries(
    Object.values(EventStatus).map((status) => [
      status,
      0,
    ]),
  ) as Record<EventStatus, number>;

  let totalEvents = 0;

  for (const group of eventStatusGroups) {
    eventCounts[group.status] = group._count._all;
    totalEvents += group._count._all;
  }

  const payoutCounts = Object.fromEntries(
    Object.values(PayoutStatus).map((status) => [
      status,
      0,
    ]),
  ) as Record<PayoutStatus, number>;

  let totalPayouts = 0;
  let payoutAmount = new Prisma.Decimal(0);
  let payoutFees = new Prisma.Decimal(0);
  let payoutNetAmount = new Prisma.Decimal(0);

  for (const group of payoutStatusGroups) {
    payoutCounts[group.status] = group._count._all;
    totalPayouts += group._count._all;
    payoutAmount = payoutAmount.plus(
      group._sum.amount ?? 0,
    );
    payoutFees = payoutFees.plus(
      group._sum.fee ?? 0,
    );
    payoutNetAmount = payoutNetAmount.plus(
      group._sum.netAmount ?? 0,
    );
  }

  const currency =
    organizer.organizerSettings?.currency ??
    organizer.organizerEvents[0]?.currency ??
    "XOF";

  return {
    id: organizer.id,
    firstName: organizer.firstName,
    lastName: organizer.lastName,
    fullName:
      `${organizer.firstName} ${organizer.lastName}`.trim(),
    email: organizer.email,
    phone: organizer.phone,
    country: organizer.country,
    countryCode: organizer.countryCode,
    dialCode: organizer.dialCode,
    emailVerified: organizer.emailVerified,
    isActive: organizer.isActive,
    createdAt: organizer.createdAt,
    updatedAt: organizer.updatedAt,
    profile: organizer.organizerProfile,
    settings: organizer.organizerSettings,
    subscriptions: organizer.organizerSubscriptions,
    payoutDestinations: organizer.payoutDestinations,
    activities: organizer.organizerActivities.map(
      (activity) => ({
        ...activity,
        amount: activity.amount?.toFixed(2) ?? null,
      }),
    ),
    recentEvents: organizer.organizerEvents,
    statistics: {
      events: {
        total: totalEvents,
        ...eventCounts,
      },
      orders: {
        total: totalOrders,
        paid: paidOrders,
      },
      tickets: {
        total: totalTickets,
      },
      revenue: {
        currency,
        subtotal:
          revenue._sum.subtotal?.toFixed(2) ?? "0.00",
        platformFee:
          revenue._sum.platformFee?.toFixed(2) ?? "0.00",
        total:
          revenue._sum.total?.toFixed(2) ?? "0.00",
      },
      payouts: {
        total: totalPayouts,
        ...payoutCounts,
        amount: payoutAmount.toFixed(2),
        fees: payoutFees.toFixed(2),
        netAmount: payoutNetAmount.toFixed(2),
        currency,
      },
    },
  };
}
