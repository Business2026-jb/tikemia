import "server-only";

import {
  OrderStatus,
  Prisma,
} from "@prisma/client";

import {
  AdminEventError,
} from "@/lib/admin/events/admin-event-errors";
import {
  prisma,
} from "@/lib/prisma";

const PAID_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.PARTIALLY_REFUNDED,
  OrderStatus.REFUNDED,
];

type RevenueCurrencyAccumulator = {
  orders: number;
  subtotal: Prisma.Decimal;
  platformFees: Prisma.Decimal;
  total: Prisma.Decimal;
};

function normalizeRequiredId(
  value: string,
): string {
  const normalized =
    value.trim();

  if (!normalized) {
    throw new AdminEventError({
      code:
        "ADMIN_EVENT_ID_REQUIRED",

      message:
        "L’identifiant de l’événement est obligatoire.",

      status:
        400,
    });
  }

  return normalized;
}

function buildFullName({
  firstName,
  lastName,
}: {
  firstName: string;
  lastName: string;
}): string {
  return `${firstName} ${lastName}`
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}

function incrementStatusCount(
  target: Record<string, number>,
  status: string,
): void {
  target[status] =
    (target[status] ?? 0) + 1;
}

function getOrCreateRevenueAccumulator(
  map: Map<
    string,
    RevenueCurrencyAccumulator
  >,
  currency: string,
): RevenueCurrencyAccumulator {
  const existing =
    map.get(
      currency,
    );

  if (existing) {
    return existing;
  }

  const created: RevenueCurrencyAccumulator = {
    orders:
      0,

    subtotal:
      new Prisma.Decimal(
        0,
      ),

    platformFees:
      new Prisma.Decimal(
        0,
      ),

    total:
      new Prisma.Decimal(
        0,
      ),
  };

  map.set(
    currency,
    created,
  );

  return created;
}

export async function getAdminEvent(
  eventId: string,
) {
  const id =
    normalizeRequiredId(
      eventId,
    );

  try {
    const event =
      await prisma.event.findUnique({
        where: {
          id,
        },

        select: {
          id:
            true,

          organizerId:
            true,

          categoryId:
            true,

          title:
            true,

          slug:
            true,

          description:
            true,

          shortDescription:
            true,

          coverImage:
            true,

          venueName:
            true,

          address:
            true,

          city:
            true,

          country:
            true,

          countryCode:
            true,

          timezone:
            true,

          latitude:
            true,

          longitude:
            true,

          startsAt:
            true,

          endsAt:
            true,

          salesStartAt:
            true,

          salesEndAt:
            true,

          currency:
            true,

          platformFeeRate:
            true,

          capacity:
            true,

          status:
            true,

          isFree:
            true,

          isFeatured:
            true,

          publishedAt:
            true,

          submittedAt:
            true,

          reviewedAt:
            true,

          reviewedById:
            true,

          rejectedAt:
            true,

          suspendedAt:
            true,

          cancelledAt:
            true,

          archivedAt:
            true,

          rejectionReason:
            true,

          suspensionReason:
            true,

          cancellationReason:
            true,

          adminNotes:
            true,

          createdAt:
            true,

          updatedAt:
            true,

          category: {
            select: {
              id:
                true,

              name:
                true,

              slug:
                true,

              description:
                true,
            },
          },

          organizer: {
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

              country:
                true,

              countryCode:
                true,

              emailVerified:
                true,

              isActive:
                true,

              createdAt:
                true,

              organizerProfile: {
                select: {
                  businessName:
                    true,

                  businessType:
                    true,

                  description:
                    true,

                  logo:
                    true,

                  avatar:
                    true,

                  city:
                    true,

                  address:
                    true,

                  website:
                    true,

                  hasBlueBadge:
                    true,
                },
              },
            },
          },

          reviewedBy: {
            select: {
              id:
                true,

              firstName:
                true,

              lastName:
                true,

              email:
                true,
            },
          },

          images: {
            orderBy: {
              position:
                "asc",
            },

            select: {
              id:
                true,

              publicUrl:
                true,

              position:
                true,

              isCover:
                true,
            },
          },

          ticketTypes: {
            orderBy: [
              {
                price:
                  "asc",
              },
              {
                createdAt:
                  "asc",
              },
            ],

            select: {
              id:
                true,

              name:
                true,

              description:
                true,

              price:
                true,

              quantity:
                true,

              sold:
                true,

              reserved:
                true,

              maxPerOrder:
                true,

              saleStartsAt:
                true,

              saleEndsAt:
                true,

              isActive:
                true,

              isTransferable:
                true,

              createdAt:
                true,

              updatedAt:
                true,
            },
          },

          moderationLogs: {
            orderBy: {
              createdAt:
                "desc",
            },

            take:
              30,

            select: {
              id:
                true,

              action:
                true,

              previousStatus:
                true,

              newStatus:
                true,

              reason:
                true,

              notes:
                true,

              metadata:
                true,

              ipAddress:
                true,

              createdAt:
                true,

              admin: {
                select: {
                  id:
                    true,

                  firstName:
                    true,

                  lastName:
                    true,

                  email:
                    true,
                },
              },
            },
          },

          platformReports: {
            orderBy: {
              createdAt:
                "desc",
            },

            take:
              20,

            select: {
              id:
                true,

              targetType:
                true,

              category:
                true,

              description:
                true,

              status:
                true,

              resolution:
                true,

              resolvedAt:
                true,

              createdAt:
                true,
            },
          },

          _count: {
            select: {
              orders:
                true,

              tickets:
                true,

              ticketTypes:
                true,

              eventFavorites:
                true,

              scannerAssignments:
                true,

              platformReports:
                true,
            },
          },
        },
      });

    if (!event) {
      throw new AdminEventError({
        code:
          "ADMIN_EVENT_NOT_FOUND",

        message:
          "Cet événement est introuvable.",

        status:
          404,
      });
    }

    const [
      eventOrders,
      eventTickets,
    ] =
      await Promise.all([
        prisma.order.findMany({
          where: {
            eventId:
              event.id,
          },

          select: {
            status:
              true,

            currency:
              true,

            subtotal:
              true,

            platformFee:
              true,

            total:
              true,
          },
        }),

        prisma.ticket.findMany({
          where: {
            eventId:
              event.id,
          },

          select: {
            status:
              true,
          },
        }),
      ]);

    const ordersByStatus:
      Record<string, number> =
      {};

    const ticketsByStatus:
      Record<string, number> =
      {};

    const revenueAccumulators =
      new Map<
        string,
        RevenueCurrencyAccumulator
      >();

    for (
      const order of eventOrders
    ) {
      incrementStatusCount(
        ordersByStatus,
        order.status,
      );

      if (
        !PAID_ORDER_STATUSES.includes(
          order.status,
        )
      ) {
        continue;
      }

      const accumulator =
        getOrCreateRevenueAccumulator(
          revenueAccumulators,
          order.currency,
        );

      accumulator.orders +=
        1;

      accumulator.subtotal =
        accumulator.subtotal.plus(
          order.subtotal,
        );

      accumulator.platformFees =
        accumulator.platformFees.plus(
          order.platformFee,
        );

      accumulator.total =
        accumulator.total.plus(
          order.total,
        );
    }

    for (
      const ticket of eventTickets
    ) {
      incrementStatusCount(
        ticketsByStatus,
        ticket.status,
      );
    }

    const revenueByCurrency:
      Record<
        string,
        {
          orders: number;
          subtotal: string;
          platformFees: string;
          total: string;
        }
      > =
      {};

    for (
      const [
        currency,
        accumulator,
      ] of revenueAccumulators
    ) {
      revenueByCurrency[
        currency
      ] = {
        orders:
          accumulator.orders,

        subtotal:
          accumulator.subtotal.toFixed(
            2,
          ),

        platformFees:
          accumulator.platformFees.toFixed(
            2,
          ),

        total:
          accumulator.total.toFixed(
            2,
          ),
      };
    }

    const organizerProfile =
      event.organizer
        .organizerProfile;

    return {
      id:
        event.id,

      organizerId:
        event.organizerId,

      categoryId:
        event.categoryId,

      title:
        event.title,

      slug:
        event.slug,

      description:
        event.description,

      shortDescription:
        event.shortDescription,

      coverImage:
        event.coverImage,

      venueName:
        event.venueName,

      address:
        event.address,

      city:
        event.city,

      country:
        event.country,

      countryCode:
        event.countryCode,

      timezone:
        event.timezone,

      latitude:
        event.latitude
          ?.toString() ??
        null,

      longitude:
        event.longitude
          ?.toString() ??
        null,

      startsAt:
        event.startsAt,

      endsAt:
        event.endsAt,

      salesStartAt:
        event.salesStartAt,

      salesEndAt:
        event.salesEndAt,

      currency:
        event.currency,

      platformFeeRate:
        event.platformFeeRate.toFixed(
          2,
        ),

      capacity:
        event.capacity,

      status:
        event.status,

      isFree:
        event.isFree,

      isFeatured:
        event.isFeatured,

      publishedAt:
        event.publishedAt,

      submittedAt:
        event.submittedAt,

      reviewedAt:
        event.reviewedAt,

      reviewedById:
        event.reviewedById,

      rejectedAt:
        event.rejectedAt,

      suspendedAt:
        event.suspendedAt,

      cancelledAt:
        event.cancelledAt,

      archivedAt:
        event.archivedAt,

      rejectionReason:
        event.rejectionReason,

      suspensionReason:
        event.suspensionReason,

      cancellationReason:
        event.cancellationReason,

      adminNotes:
        event.adminNotes,

      createdAt:
        event.createdAt,

      updatedAt:
        event.updatedAt,

      category:
        event.category,

      organizer: {
        id:
          event.organizer.id,

        firstName:
          event.organizer.firstName,

        lastName:
          event.organizer.lastName,

        fullName:
          buildFullName({
            firstName:
              event.organizer.firstName,

            lastName:
              event.organizer.lastName,
          }),

        email:
          event.organizer.email,

        phone:
          event.organizer.phone,

        country:
          event.organizer.country,

        countryCode:
          event.organizer.countryCode,

        emailVerified:
          event.organizer.emailVerified,

        isActive:
          event.organizer.isActive,

        createdAt:
          event.organizer.createdAt,

        profile:
          organizerProfile
            ? {
                businessName:
                  organizerProfile.businessName,

                businessType:
                  organizerProfile.businessType,

                description:
                  organizerProfile.description,

                logo:
                  organizerProfile.logo,

                avatar:
                  organizerProfile.avatar,

                city:
                  organizerProfile.city,

                address:
                  organizerProfile.address,

                website:
                  organizerProfile.website,

                hasBlueBadge:
                  organizerProfile.hasBlueBadge,
              }
            : null,
      },

      reviewedBy:
        event.reviewedBy
          ? {
              id:
                event.reviewedBy.id,

              firstName:
                event.reviewedBy.firstName,

              lastName:
                event.reviewedBy.lastName,

              fullName:
                buildFullName({
                  firstName:
                    event.reviewedBy.firstName,

                  lastName:
                    event.reviewedBy.lastName,
                }),

              email:
                event.reviewedBy.email,
            }
          : null,

      images:
        event.images,

      ticketTypes:
        event.ticketTypes.map(
          (
            ticketType,
          ) => ({
            id:
              ticketType.id,

            name:
              ticketType.name,

            description:
              ticketType.description,

            price:
              ticketType.price.toFixed(
                2,
              ),

            quantity:
              ticketType.quantity,

            sold:
              ticketType.sold,

            reserved:
              ticketType.reserved,

            available:
              Math.max(
                ticketType.quantity -
                  ticketType.sold -
                  ticketType.reserved,
                0,
              ),

            maxPerOrder:
              ticketType.maxPerOrder,

            saleStartsAt:
              ticketType.saleStartsAt,

            saleEndsAt:
              ticketType.saleEndsAt,

            isActive:
              ticketType.isActive,

            isTransferable:
              ticketType.isTransferable,

            createdAt:
              ticketType.createdAt,

            updatedAt:
              ticketType.updatedAt,
          }),
        ),

      moderationLogs:
        event.moderationLogs.map(
          (
            log,
          ) => ({
            id:
              log.id,

            action:
              log.action,

            previousStatus:
              log.previousStatus,

            newStatus:
              log.newStatus,

            reason:
              log.reason,

            notes:
              log.notes,

            metadata:
              log.metadata,

            ipAddress:
              log.ipAddress,

            createdAt:
              log.createdAt,

            admin: {
              id:
                log.admin.id,

              firstName:
                log.admin.firstName,

              lastName:
                log.admin.lastName,

              fullName:
                buildFullName({
                  firstName:
                    log.admin.firstName,

                  lastName:
                    log.admin.lastName,
                }),

              email:
                log.admin.email,
            },
          }),
        ),

      platformReports:
        event.platformReports,

      statistics: {
        orders:
          event._count.orders,

        tickets:
          event._count.tickets,

        ticketTypes:
          event._count.ticketTypes,

        favorites:
          event._count.eventFavorites,

        scanners:
          event._count.scannerAssignments,

        reports:
          event._count.platformReports,

        ordersByStatus,
        ticketsByStatus,
        revenueByCurrency,
      },
    };
  } catch (error) {
    if (
      error instanceof
      AdminEventError
    ) {
      throw error;
    }

    throw new AdminEventError({
      code:
        "ADMIN_EVENT_QUERY_INVALID",

      message:
        "Impossible de charger les informations de l’événement.",

      status:
        500,

      cause:
        error,
    });
  }
}