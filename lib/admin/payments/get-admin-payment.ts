import "server-only";

import {
  Prisma,
} from "@prisma/client";

import {
  AdminPaymentError,
} from "@/lib/admin/payments/admin-payment-errors";
import {
  prisma,
} from "@/lib/prisma";

function normalizeRequiredId(
  value: string,
): string {
  const normalized =
    value.trim();

  if (!normalized) {
    throw new AdminPaymentError({
      code:
        "ADMIN_PAYMENT_ID_REQUIRED",
      message:
        "L’identifiant du paiement est obligatoire.",
      status: 400,
    });
  }

  return normalized;
}

export async function getAdminPayment(
  paymentId: string,
) {
  const id =
    normalizeRequiredId(
      paymentId,
    );

  try {
    const payment =
      await prisma.payment.findUnique({
        where: {
          id,
        },

        select: {
          id: true,
          orderId: true,
          provider: true,
          providerReference: true,
          providerTransactionId: true,
          method: true,
          amount: true,
          currency: true,
          status: true,
          checkoutUrl: true,
          returnUrl: true,
          cancelUrl: true,
          customerEmail: true,
          customerPhone: true,
          idempotencyKey: true,
          failureCode: true,
          failureReason: true,
          metadata: true,
          initiatedAt: true,
          expiresAt: true,
          processingAt: true,
          paidAt: true,
          failedAt: true,
          cancelledAt: true,
          refundedAt: true,
          createdAt: true,
          updatedAt: true,

          order: {
            select: {
              id: true,
              reference: true,
              customerId: true,
              customerName: true,
              customerEmail: true,
              customerPhone: true,
              currency: true,
              subtotal: true,
              platformFee: true,
              total: true,
              status: true,
              reservationExpiresAt: true,
              checkoutStartedAt: true,
              paymentConfirmedAt: true,
              finalizedAt: true,
              ticketsIssuedAt: true,
              paidAt: true,
              cancelledAt: true,
              failedAt: true,
              expiredAt: true,
              refundedAt: true,
              createdAt: true,
              updatedAt: true,

              event: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  venueName: true,
                  address: true,
                  city: true,
                  country: true,
                  startsAt: true,
                  endsAt: true,
                  currency: true,

                  organizer: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      email: true,
                      phone: true,

                      organizerProfile: {
                        select: {
                          businessName: true,
                          logo: true,
                          avatar: true,
                        },
                      },
                    },
                  },
                },
              },

              items: {
                orderBy: {
                  id: "asc",
                },

                select: {
                  id: true,
                  quantity: true,
                  unitPrice: true,
                  subtotal: true,
                  platformFee: true,
                  total: true,

                  ticketType: {
                    select: {
                      id: true,
                      name: true,
                      description: true,
                    },
                  },
                },
              },

              tickets: {
                orderBy: {
                  createdAt: "asc",
                },

                select: {
                  id: true,
                  code: true,
                  status: true,
                  holderName: true,
                  holderEmail: true,
                  holderPhone: true,
                  issuedAt: true,
                  scannedAt: true,
                  usedAt: true,

                  ticketType: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },

              deliveryLogs: {
                orderBy: {
                  createdAt: "desc",
                },

                take: 100,

                select: {
                  id: true,
                  channel: true,
                  type: true,
                  status: true,
                  recipient: true,
                  provider: true,
                  providerMessageId: true,
                  subject: true,
                  attachmentName: true,
                  attempts: true,
                  lastAttemptAt: true,
                  sentAt: true,
                  deliveredAt: true,
                  failedAt: true,
                  errorCode: true,
                  errorMessage: true,
                  createdAt: true,
                  updatedAt: true,
                },
              },
            },
          },

          attempts: {
            orderBy: {
              createdAt: "desc",
            },

            select: {
              id: true,
              provider: true,
              providerReference: true,
              providerTransactionId: true,
              method: true,
              amount: true,
              currency: true,
              status: true,
              checkoutUrl: true,
              idempotencyKey: true,
              requestPayload: true,
              responsePayload: true,
              failureCode: true,
              failureReason: true,
              initiatedAt: true,
              expiresAt: true,
              processingAt: true,
              paidAt: true,
              failedAt: true,
              cancelledAt: true,
              createdAt: true,
              updatedAt: true,
            },
          },

          webhookEvents: {
            orderBy: {
              receivedAt: "desc",
            },

            take: 100,

            select: {
              id: true,
              provider: true,
              providerEventId: true,
              eventType: true,
              signatureVerified: true,
              status: true,
              processingAttempts: true,
              receivedAt: true,
              processingStartedAt: true,
              processedAt: true,
              failedAt: true,
              lastError: true,
              createdAt: true,
              updatedAt: true,
            },
          },

          refunds: {
            orderBy: {
              requestedAt: "desc",
            },

            select: {
              id: true,
              reference: true,
              providerReference: true,
              providerTransactionId: true,
              amount: true,
              currency: true,
              status: true,
              reason: true,
              requestedBy: true,
              requestedAt: true,
              processingAt: true,
              refundedAt: true,
              failedAt: true,
              failureReason: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      });

    if (!payment) {
      throw new AdminPaymentError({
        code:
          "ADMIN_PAYMENT_NOT_FOUND",
        message:
          "Ce paiement est introuvable.",
        status: 404,
      });
    }

    const organizer =
      payment.order.event.organizer;

    const refundedAmount =
      payment.refunds.reduce(
        (total, refund) =>
          total.plus(
            refund.amount,
          ),
        new Prisma.Decimal(0),
      );

    return {
      ...payment,

      amount:
        payment.amount.toFixed(2),

      order: {
        ...payment.order,

        subtotal:
          payment.order.subtotal.toFixed(
            2,
          ),

        platformFee:
          payment.order.platformFee.toFixed(
            2,
          ),

        total:
          payment.order.total.toFixed(
            2,
          ),

        event: {
          ...payment.order.event,

          organizer: {
            id:
              organizer.id,
            firstName:
              organizer.firstName,
            lastName:
              organizer.lastName,
            fullName:
              `${organizer.firstName} ${organizer.lastName}`
                .replace(/\s+/g, " ")
                .trim(),
            email:
              organizer.email,
            phone:
              organizer.phone,
            profile:
              organizer.organizerProfile,
          },
        },

        items:
          payment.order.items.map(
            (item) => ({
              ...item,
              unitPrice:
                item.unitPrice.toFixed(
                  2,
                ),
              subtotal:
                item.subtotal.toFixed(
                  2,
                ),
              platformFee:
                item.platformFee.toFixed(
                  2,
                ),
              total:
                item.total.toFixed(
                  2,
                ),
            }),
          ),
      },

      attempts:
        payment.attempts.map(
          (attempt) => ({
            ...attempt,
            amount:
              attempt.amount.toFixed(
                2,
              ),
          }),
        ),

      refunds:
        payment.refunds.map(
          (refund) => ({
            ...refund,
            amount:
              refund.amount.toFixed(
                2,
              ),
          }),
        ),

      statistics: {
        attempts:
          payment.attempts.length,
        webhookEvents:
          payment.webhookEvents.length,
        refunds:
          payment.refunds.length,
        refundedAmount:
          refundedAmount.toFixed(2),
        tickets:
          payment.order.tickets.length,
        deliveries:
          payment.order.deliveryLogs.length,
      },
    };
  } catch (error) {
    if (
      error instanceof
      AdminPaymentError
    ) {
      throw error;
    }

    throw new AdminPaymentError({
      code:
        "ADMIN_PAYMENT_QUERY_INVALID",
      message:
        "Impossible de charger les informations du paiement.",
      status: 500,
      cause: error,
    });
  }
}
