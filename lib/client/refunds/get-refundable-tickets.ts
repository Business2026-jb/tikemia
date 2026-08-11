import "server-only";

import {
  PaymentStatus,
  Prisma,
  RefundStatus,
} from "@prisma/client";

import {
  prisma,
} from "@/lib/prisma";

import {
  evaluateRefundEligibility,
} from "@/lib/client/refunds/refund-eligibility";

const REFUND_METADATA_KIND =
  "CLIENT_TICKET_REFUND_REQUEST";

type ClientIdentity = Readonly<{
  id: string;
  email: string;
}>;

type RefundMetadata = Readonly<{
  kind?: unknown;
  ticketIds?: unknown;
}>;

export type RefundableTicket = Readonly<{
  id: string;
  code: string;
  holderName: string;
  holderEmail: string;
  status: string;
  issuedAt: string;
  usedAt: string | null;

  ticketType: Readonly<{
    id: string;
    name: string;
    description: string | null;
  }>;

  event: Readonly<{
    id: string;
    slug: string;
    title: string;
    coverImage: string | null;
    venueName: string;
    city: string;
    country: string;
    startsAt: string;
    endsAt: string | null;
    organizerId: string;
  }>;

  order: Readonly<{
    id: string;
    reference: string;
    currency: string;
    paidAt: string;
    paymentId: string;
    paymentStatus: string;
    provider: string;
    providerTransactionId:
      string | null;
  }>;

  amount: Readonly<{
    requestedAmount: string;
    currency: string;
  }>;

  eligibility: Readonly<{
    eligible: true;
    deadline: string;
    remainingMs: number;
  }>;
}>;

function normalizeEmail(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase();
}

function readMetadataTicketIds(
  value:
    Prisma.JsonValue | null,
): string[] {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(value)
  ) {
    return [];
  }

  const metadata =
    value as RefundMetadata;

  if (
    metadata.kind !==
      REFUND_METADATA_KIND ||
    !Array.isArray(
      metadata.ticketIds,
    )
  ) {
    return [];
  }

  return metadata.ticketIds
    .filter(
      (
        ticketId,
      ): ticketId is string =>
        typeof ticketId ===
          "string" &&
        Boolean(
          ticketId.trim(),
        ),
    )
    .map(
      (ticketId) =>
        ticketId.trim(),
    );
}

function buildTicketOwnershipWhere({
  customerId,
  customerEmail,
}: {
  customerId: string;
  customerEmail: string;
}): Prisma.TicketWhereInput {
  return {
    OR: [
      {
        ownerId:
          customerId,
      },

      {
        AND: [
          {
            ownerId:
              null,
          },

          {
            holderEmail: {
              equals:
                customerEmail,

              mode:
                Prisma.QueryMode
                  .insensitive,
            },
          },
        ],
      },
    ],
  };
}

function calculateTicketAmount({
  paymentAmount,
  orderTotal,
  orderItemTotal,
  orderItemQuantity,
}: {
  paymentAmount:
    Prisma.Decimal;

  orderTotal:
    Prisma.Decimal;

  orderItemTotal:
    Prisma.Decimal;

  orderItemQuantity:
    number;
}): Prisma.Decimal {
  if (
    orderItemQuantity <=
    0
  ) {
    return new Prisma.Decimal(
      0,
    );
  }

  const itemPerTicket =
    orderItemTotal.div(
      orderItemQuantity,
    );

  if (
    orderTotal.lte(
      0,
    )
  ) {
    return itemPerTicket;
  }

  return paymentAmount
    .mul(
      itemPerTicket,
    )
    .div(
      orderTotal,
    )
    .toDecimalPlaces(
      2,
      Prisma.Decimal
        .ROUND_HALF_UP,
    );
}

export async function getRefundableTickets({
  customer,
  now = new Date(),
}: {
  customer:
    ClientIdentity;

  now?:
    Date;
}): Promise<
  RefundableTicket[]
> {
  const customerEmail =
    normalizeEmail(
      customer.email,
    );

  const tickets =
    await prisma.ticket
      .findMany({
        where: {
          AND: [
            buildTicketOwnershipWhere({
              customerId:
                customer.id,

              customerEmail,
            }),

            {
              status:
                "VALID",
            },

            {
              usedAt:
                null,
            },

            {
              order: {
                payment: {
                  is: {
                    status: {
                      in: [
                        PaymentStatus
                          .SUCCESS,

                        PaymentStatus
                          .PARTIALLY_REFUNDED,
                      ],
                    },
                  },
                },
              },
            },
          ],
        },

        orderBy: [
          {
            order: {
              paidAt:
                "desc",
            },
          },

          {
            createdAt:
              "desc",
          },
        ],

        select: {
          id:
            true,

          code:
            true,

          holderName:
            true,

          holderEmail:
            true,

          status:
            true,

          issuedAt:
            true,

          usedAt:
            true,

          ticketType: {
            select: {
              id:
                true,

              name:
                true,

              description:
                true,
            },
          },

          orderItem: {
            select: {
              quantity:
                true,

              total:
                true,
            },
          },

          event: {
            select: {
              id:
                true,

              slug:
                true,

              title:
                true,

              coverImage:
                true,

              venueName:
                true,

              city:
                true,

              country:
                true,

              startsAt:
                true,

              endsAt:
                true,

              organizerId:
                true,
            },
          },

          order: {
            select: {
              id:
                true,

              reference:
                true,

              currency:
                true,

              total:
                true,

              paidAt:
                true,

              payment: {
                select: {
                  id:
                    true,

                  status:
                    true,

                  amount:
                    true,

                  provider:
                    true,

                  providerTransactionId:
                    true,

                  paidAt:
                    true,
                },
              },
            },
          },
        },
      });

  if (
    tickets.length ===
    0
  ) {
    return [];
  }

  const orderIds =
    Array.from(
      new Set(
        tickets.map(
          (
            ticket,
          ) =>
            ticket.order.id,
        ),
      ),
    );

  const activeRefunds =
    await prisma.paymentRefund
      .findMany({
        where: {
          orderId: {
            in:
              orderIds,
          },

          status: {
            in: [
              RefundStatus
                .PENDING,

              RefundStatus
                .PROCESSING,
            ],
          },
        },

        select: {
          metadata:
            true,
        },
      });

  const activeTicketIds =
    new Set<string>();

  for (
    const refund of
    activeRefunds
  ) {
    for (
      const ticketId of
      readMetadataTicketIds(
        refund.metadata,
      )
    ) {
      activeTicketIds.add(
        ticketId,
      );
    }
  }

  const result:
    RefundableTicket[] =
    [];

  for (
    const ticket of
    tickets
  ) {
    const payment =
      ticket.order.payment;

    const paidAt =
      payment?.paidAt ??
      ticket.order.paidAt ??
      null;

    const eligibility =
      evaluateRefundEligibility({
        now,

        paidAt,

        paymentStatus:
          payment?.status ??
          null,

        ticketStatus:
          ticket.status,

        ticketUsedAt:
          ticket.usedAt,

        eventStartsAt:
          ticket.event
            .startsAt,

        eventEndsAt:
          ticket.event
            .endsAt,

        hasActiveRefundRequest:
          activeTicketIds.has(
            ticket.id,
          ),
      });

    if (
      !eligibility.eligible ||
      !eligibility.deadline ||
      !paidAt ||
      !payment
    ) {
      continue;
    }

    const requestedAmount =
      calculateTicketAmount({
        paymentAmount:
          payment.amount,

        orderTotal:
          ticket.order.total,

        orderItemTotal:
          ticket.orderItem
            .total,

        orderItemQuantity:
          ticket.orderItem
            .quantity,
      });

    result.push(
      Object.freeze({
        id:
          ticket.id,

        code:
          ticket.code,

        holderName:
          ticket.holderName,

        holderEmail:
          ticket.holderEmail,

        status:
          ticket.status,

        issuedAt:
          ticket.issuedAt
            .toISOString(),

        usedAt:
          ticket.usedAt
            ?.toISOString() ??
          null,

        ticketType: {
          id:
            ticket.ticketType.id,

          name:
            ticket.ticketType.name,

          description:
            ticket.ticketType
              .description,
        },

        event: {
          id:
            ticket.event.id,

          slug:
            ticket.event.slug,

          title:
            ticket.event.title,

          coverImage:
            ticket.event
              .coverImage,

          venueName:
            ticket.event
              .venueName,

          city:
            ticket.event.city,

          country:
            ticket.event.country,

          startsAt:
            ticket.event
              .startsAt
              .toISOString(),

          endsAt:
            ticket.event
              .endsAt
              ?.toISOString() ??
            null,

          organizerId:
            ticket.event
              .organizerId,
        },

        order: {
          id:
            ticket.order.id,

          reference:
            ticket.order
              .reference,

          currency:
            ticket.order
              .currency,

          paidAt:
            paidAt.toISOString(),

          paymentId:
            payment.id,

          paymentStatus:
            payment.status,

          provider:
            payment.provider,

          providerTransactionId:
            payment
              .providerTransactionId,
        },

        amount: {
          requestedAmount:
            requestedAmount
              .toFixed(2),

          currency:
            ticket.order
              .currency,
        },

        eligibility: {
          eligible:
            true as const,

          deadline:
            eligibility
              .deadline
              .toISOString(),

          remainingMs:
            eligibility
              .remainingMs,
        },
      }),
    );
  }

  return result;
}