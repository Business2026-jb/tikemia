import "server-only";

import {
  OrderStatus,
  Prisma,
  PayoutStatus,
} from "@prisma/client";

import {
  AdminPayoutError,
} from "@/lib/admin/payouts/admin-payout-errors";
import {
  prisma,
} from "@/lib/prisma";

function normalizePayoutId(
  payoutId: string,
): string {
  const normalized =
    payoutId.trim();

  if (!normalized) {
    throw new AdminPayoutError({
      code:
        "ADMIN_PAYOUT_ID_REQUIRED",
      message:
        "L’identifiant de la demande de retrait est obligatoire.",
      status:
        400,
    });
  }

  return normalized;
}

function buildOrganizerFullName({
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

function extractInformationRequestMessage(
  adminNote:
    | string
    | null,
): string | null {
  if (
    !adminNote?.startsWith(
      "[INFORMATION_REQUIRED]",
    )
  ) {
    return null;
  }

  const message =
    adminNote
      .replace(
        "[INFORMATION_REQUIRED]",
        "",
      )
      .replace(
        /\[ADMIN:[^\]]+\]/g,
        "",
      )
      .replace(
        /\[DATE:[^\]]+\]/g,
        "",
      )
      .replace(
        /\s+/g,
        " ",
      )
      .trim();

  return message || null;
}

export async function getAdminPayout(
  payoutId: string,
) {
  const id =
    normalizePayoutId(
      payoutId,
    );

  try {
    const payout =
      await prisma.payout.findUnique({
        where: {
          id,
        },

        select: {
          id:
            true,
          organizerId:
            true,
          amount:
            true,
          fee:
            true,
          netAmount:
            true,
          currency:
            true,
          status:
            true,
          reference:
            true,
          note:
            true,
          requestedAt:
            true,
          processedAt:
            true,
          createdAt:
            true,
          updatedAt:
            true,
          adminNote:
            true,
          destinationId:
            true,
          destinationSnapshot:
            true,
          destinationType:
            true,
          rejectionReason:
            true,

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
              dialCode:
                true,
              isActive:
                true,
              emailVerified:
                true,
              createdAt:
                true,

              organizerProfile: {
                select: {
                  businessName:
                    true,
                  logo:
                    true,
                  avatar:
                    true,
                  description:
                    true,
                },
              },

              organizerEvents: {
                orderBy: {
                  createdAt:
                    "desc",
                },

                take:
                  50,

                select: {
                  id:
                    true,
                  title:
                    true,
                  slug:
                    true,
                  status:
                    true,
                  startsAt:
                    true,
                  city:
                    true,
                  country:
                    true,
                  currency:
                    true,

                  orders: {
                    where: {
                      status:
                        OrderStatus.PAID,
                    },

                    select: {
                      total:
                        true,
                      platformFee:
                        true,
                    },
                  },
                },
              },
            },
          },

          destination: {
            select: {
              id:
                true,
              organizerId:
                true,
              type:
                true,
              status:
                true,
              country:
                true,
              countryCode:
                true,
              currency:
                true,
              accountName:
                true,
              mobileProvider:
                true,
              phoneCountryCode:
                true,
              phoneNumberLast4:
                true,
              bankName:
                true,
              bankAccountNumberLast4:
                true,
              ibanLast4:
                true,
              swiftBic:
                true,
              bankCode:
                true,
              branchCode:
                true,
              bankAddress:
                true,
              cryptoNetwork:
                true,
              cryptoAddressLast6:
                true,
              isDefault:
                true,
              isActive:
                true,
              verifiedAt:
                true,
              rejectedAt:
                true,
              rejectionReason:
                true,
              createdAt:
                true,
              updatedAt:
                true,
            },
          },
        },
      });

    if (!payout) {
      throw new AdminPayoutError({
        code:
          "ADMIN_PAYOUT_NOT_FOUND",
        message:
          "Cette demande de retrait est introuvable.",
        status:
          404,
      });
    }

    const events =
      payout.organizer
        .organizerEvents
        .map(
          (
            event,
          ) => {
            const grossRevenue =
              event.orders.reduce(
                (
                  total,
                  order,
                ) =>
                  total.plus(
                    order.total,
                  ),
                new Prisma.Decimal(
                  0,
                ),
              );

            const platformFees =
              event.orders.reduce(
                (
                  total,
                  order,
                ) =>
                  total.plus(
                    order.platformFee,
                  ),
                new Prisma.Decimal(
                  0,
                ),
              );

            const estimatedNetRevenue =
              grossRevenue.minus(
                platformFees,
              );

            return {
              id:
                event.id,
              title:
                event.title,
              slug:
                event.slug,
              status:
                event.status,
              startsAt:
                event.startsAt,
              city:
                event.city,
              country:
                event.country,
              currency:
                event.currency,
              paidOrders:
                event.orders.length,
              grossRevenue:
                grossRevenue.toFixed(
                  2,
                ),
              platformFees:
                platformFees.toFixed(
                  2,
                ),
              estimatedNetRevenue:
                estimatedNetRevenue.toFixed(
                  2,
                ),
            };
          },
        );

    const totalGrossRevenue =
      events.reduce(
        (
          total,
          event,
        ) =>
          total.plus(
            event.grossRevenue,
          ),
        new Prisma.Decimal(
          0,
        ),
      );

    const totalPlatformFees =
      events.reduce(
        (
          total,
          event,
        ) =>
          total.plus(
            event.platformFees,
          ),
        new Prisma.Decimal(
          0,
        ),
      );

    const totalEstimatedNetRevenue =
      events.reduce(
        (
          total,
          event,
        ) =>
          total.plus(
            event.estimatedNetRevenue,
          ),
        new Prisma.Decimal(
          0,
        ),
      );

    const informationRequestMessage =
      extractInformationRequestMessage(
        payout.adminNote,
      );

    return {
      id:
        payout.id,
      organizerId:
        payout.organizerId,
      amount:
        payout.amount.toFixed(
          2,
        ),
      fee:
        payout.fee.toFixed(
          2,
        ),
      netAmount:
        payout.netAmount.toFixed(
          2,
        ),
      currency:
        payout.currency,
      status:
        payout.status,
      reference:
        payout.reference,
      note:
        payout.note,
      requestedAt:
        payout.requestedAt,
      processedAt:
        payout.processedAt,
      createdAt:
        payout.createdAt,
      updatedAt:
        payout.updatedAt,
      adminNote:
        payout.adminNote,
      destinationId:
        payout.destinationId,
      destinationSnapshot:
        payout.destinationSnapshot,
      destinationType:
        payout.destinationType,
      rejectionReason:
        payout.rejectionReason,

      organizer: {
        id:
          payout.organizer.id,
        firstName:
          payout.organizer.firstName,
        lastName:
          payout.organizer.lastName,
        fullName:
          buildOrganizerFullName({
            firstName:
              payout.organizer.firstName,
            lastName:
              payout.organizer.lastName,
          }),
        email:
          payout.organizer.email,
        phone:
          payout.organizer.phone,
        country:
          payout.organizer.country,
        countryCode:
          payout.organizer.countryCode,
        dialCode:
          payout.organizer.dialCode,
        isActive:
          payout.organizer.isActive,
        emailVerified:
          payout.organizer.emailVerified,
        createdAt:
          payout.organizer.createdAt,
        profile:
          payout.organizer
            .organizerProfile,
      },

      destination:
        payout.destination,

      revenueSummary: {
        events,
        eventsCount:
          events.length,
        paidOrdersCount:
          events.reduce(
            (
              total,
              event,
            ) =>
              total +
              event.paidOrders,
            0,
          ),
        grossRevenue:
          totalGrossRevenue.toFixed(
            2,
          ),
        platformFees:
          totalPlatformFees.toFixed(
            2,
          ),
        estimatedNetRevenue:
          totalEstimatedNetRevenue.toFixed(
            2,
          ),
      },

      informationRequest:
        informationRequestMessage
          ? {
              pending:
                payout.status ===
                PayoutStatus.PENDING,
              message:
                informationRequestMessage,
            }
          : null,
    };
  } catch (error) {
    if (
      error instanceof
      AdminPayoutError
    ) {
      throw error;
    }

    throw new AdminPayoutError({
      code:
        "ADMIN_PAYOUT_QUERY_INVALID",
      message:
        "Impossible de charger le dossier de retrait.",
      status:
        500,
      cause:
        error,
    });
  }
}