import "server-only";

import {
  randomBytes,
} from "node:crypto";

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

const REFUND_METADATA_VERSION =
  1;

const MIN_REASON_LENGTH =
  10;

const MAX_REASON_LENGTH =
  2_000;

const MAX_TICKETS_PER_REQUEST =
  20;

type ClientIdentity = Readonly<{
  id: string;
  email: string;
}>;

export type CreateRefundRequestInput =
  Readonly<{
    customer: ClientIdentity;
    ticketIds: readonly string[];
    reason: string;
    reasonCategory?: string | null;
    now?: Date;
  }>;

export type CreatedRefundRequest =
  Readonly<{
    id: string;
    reference: string;
    status: RefundStatus;
    workflowStage:
      "ORGANIZER_REVIEW";
    orderId: string;
    paymentId: string;
    eventId: string;
    organizerId: string;
    ticketIds: readonly string[];
    requestedAmount: string;
    currency: string;
    requestedAt: string;
    eligibilityDeadline: string;
  }>;

export class ClientRefundRequestError
  extends Error {
  readonly code: string;
  readonly status: number;

  constructor({
    code,
    message,
    status,
  }: {
    code: string;
    message: string;
    status: number;
  }) {
    super(message);

    this.name =
      "ClientRefundRequestError";
    this.code = code;
    this.status = status;

    Object.setPrototypeOf(
      this,
      new.target.prototype,
    );
  }
}

function normalizeText(
  value: string | null | undefined,
): string {
  return value?.trim() ?? "";
}

function normalizeEmail(
  value: string,
): string {
  return value.trim().toLowerCase();
}

function normalizeTicketIds(
  ticketIds: readonly string[],
): string[] {
  return Array.from(
    new Set(
      ticketIds
        .map(normalizeText)
        .filter(Boolean),
    ),
  );
}

function generateRefundReference():
  string {
  const suffix =
    randomBytes(6)
      .toString("hex")
      .toUpperCase();

  return `RFD-${new Date().getUTCFullYear()}-${suffix}`;
}

function toJsonValue(
  value: unknown,
): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(value),
  ) as Prisma.InputJsonValue;
}

function readTicketIdsFromMetadata(
  value: Prisma.JsonValue | null,
): string[] {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return [];
  }

  const metadata =
    value as Record<
      string,
      unknown
    >;

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
      (item): item is string =>
        typeof item === "string" &&
        Boolean(item.trim()),
    )
    .map((item) => item.trim());
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
        ownerId: customerId,
      },
      {
        AND: [
          {
            ownerId: null,
          },
          {
            holderEmail: {
              equals: customerEmail,
              mode:
                Prisma.QueryMode.insensitive,
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
  paymentAmount: Prisma.Decimal;
  orderTotal: Prisma.Decimal;
  orderItemTotal: Prisma.Decimal;
  orderItemQuantity: number;
}): Prisma.Decimal {
  if (orderItemQuantity <= 0) {
    return new Prisma.Decimal(0);
  }

  const perTicket =
    orderItemTotal.div(
      orderItemQuantity,
    );

  if (orderTotal.lte(0)) {
    return perTicket;
  }

  return paymentAmount
    .mul(perTicket)
    .div(orderTotal)
    .toDecimalPlaces(
      2,
      Prisma.Decimal.ROUND_HALF_UP,
    );
}

function assertReason(
  reason: string,
): string {
  const normalized =
    normalizeText(reason);

  if (
    normalized.length <
    MIN_REASON_LENGTH
  ) {
    throw new ClientRefundRequestError({
      code:
        "REFUND_REASON_TOO_SHORT",
      message:
        `Expliquez votre demande en au moins ${MIN_REASON_LENGTH} caractères.`,
      status: 400,
    });
  }

  if (
    normalized.length >
    MAX_REASON_LENGTH
  ) {
    throw new ClientRefundRequestError({
      code:
        "REFUND_REASON_TOO_LONG",
      message:
        `Le motif de remboursement ne peut pas dépasser ${MAX_REASON_LENGTH} caractères.`,
      status: 400,
    });
  }

  return normalized;
}

export async function createRefundRequest(
  input: CreateRefundRequestInput,
): Promise<CreatedRefundRequest> {
  const now =
    input.now ?? new Date();

  const customerEmail =
    normalizeEmail(
      input.customer.email,
    );

  const ticketIds =
    normalizeTicketIds(
      input.ticketIds,
    );

  const reason =
    assertReason(input.reason);

  const reasonCategory =
    normalizeText(
      input.reasonCategory,
    ) || null;

  if (ticketIds.length === 0) {
    throw new ClientRefundRequestError({
      code:
        "REFUND_TICKETS_REQUIRED",
      message:
        "Sélectionnez au moins un billet à rembourser.",
      status: 400,
    });
  }

  if (
    ticketIds.length >
    MAX_TICKETS_PER_REQUEST
  ) {
    throw new ClientRefundRequestError({
      code:
        "REFUND_TOO_MANY_TICKETS",
      message:
        `Une demande ne peut pas contenir plus de ${MAX_TICKETS_PER_REQUEST} billets.`,
      status: 400,
    });
  }

  return prisma.$transaction(
    async (transaction) => {
      const tickets =
        await transaction.ticket.findMany({
          where: {
            id: {
              in: ticketIds,
            },
            AND: [
              buildTicketOwnershipWhere({
                customerId:
                  input.customer.id,
                customerEmail,
              }),
            ],
          },

          select: {
            id: true,
            code: true,
            status: true,
            usedAt: true,
            orderId: true,
            orderItemId: true,

            ticketType: {
              select: {
                id: true,
                name: true,
              },
            },

            orderItem: {
              select: {
                quantity: true,
                total: true,
              },
            },

            event: {
              select: {
                id: true,
                title: true,
                organizerId: true,
                startsAt: true,
                endsAt: true,
              },
            },

            order: {
              select: {
                id: true,
                reference: true,
                currency: true,
                total: true,
                paidAt: true,

                payment: {
                  select: {
                    id: true,
                    status: true,
                    amount: true,
                    provider: true,
                    providerReference: true,
                    providerTransactionId:
                      true,
                    paidAt: true,
                  },
                },
              },
            },
          },
        });

      if (
        tickets.length !==
        ticketIds.length
      ) {
        throw new ClientRefundRequestError({
          code:
            "REFUND_TICKET_NOT_FOUND_OR_NOT_OWNED",
          message:
            "Un ou plusieurs billets sélectionnés sont introuvables ou ne vous appartiennent plus.",
          status: 403,
        });
      }

      const orderIds =
        new Set(
          tickets.map(
            (ticket) =>
              ticket.orderId,
          ),
        );

      if (orderIds.size !== 1) {
        throw new ClientRefundRequestError({
          code:
            "REFUND_SINGLE_ORDER_REQUIRED",
          message:
            "Les billets d’une même demande doivent appartenir à la même commande.",
          status: 400,
        });
      }

      const firstTicket =
        tickets[0];

      if (!firstTicket) {
        throw new ClientRefundRequestError({
          code:
            "REFUND_TICKETS_REQUIRED",
          message:
            "Aucun billet n’a été sélectionné.",
          status: 400,
        });
      }

      const payment =
        firstTicket.order.payment;

      if (!payment) {
        throw new ClientRefundRequestError({
          code:
            "REFUND_PAYMENT_NOT_FOUND",
          message:
            "Le paiement associé à cette commande est introuvable.",
          status: 409,
        });
      }

      if (
        payment.status !==
          PaymentStatus.SUCCESS &&
        payment.status !==
          PaymentStatus.PARTIALLY_REFUNDED
      ) {
        throw new ClientRefundRequestError({
          code:
            "REFUND_PAYMENT_NOT_CONFIRMED",
          message:
            "Le paiement de cette commande n’est pas éligible au remboursement.",
          status: 409,
        });
      }

      const activeRefunds =
        await transaction.paymentRefund
          .findMany({
            where: {
              orderId:
                firstTicket.order.id,
              status: {
                in: [
                  RefundStatus.PENDING,
                  RefundStatus.PROCESSING,
                ],
              },
            },
            select: {
              metadata: true,
            },
          });

      const activeTicketIds =
        new Set<string>();

      for (
        const refund of activeRefunds
      ) {
        for (
          const ticketId of
          readTicketIdsFromMetadata(
            refund.metadata,
          )
        ) {
          activeTicketIds.add(ticketId);
        }
      }

      const paidAt =
        payment.paidAt ??
        firstTicket.order.paidAt;

      let eligibilityDeadline:
        Date | null =
        null;

      for (const ticket of tickets) {
        const eligibility =
          evaluateRefundEligibility({
            now,
            paidAt,
            paymentStatus:
              payment.status,
            ticketStatus:
              ticket.status,
            ticketUsedAt:
              ticket.usedAt,
            eventStartsAt:
              ticket.event.startsAt,
            eventEndsAt:
              ticket.event.endsAt,
            hasActiveRefundRequest:
              activeTicketIds.has(
                ticket.id,
              ),
          });

        if (
          !eligibility.eligible
        ) {
          throw new ClientRefundRequestError({
            code:
              `REFUND_${eligibility.code}`,
            message:
              `${ticket.code} : ${eligibility.message}`,
            status: 409,
          });
        }

        eligibilityDeadline =
          eligibility.deadline;
      }

      if (
        !paidAt ||
        !eligibilityDeadline
      ) {
        throw new ClientRefundRequestError({
          code:
            "REFUND_PURCHASE_DATE_UNAVAILABLE",
          message:
            "La date de confirmation du paiement est indisponible.",
          status: 409,
        });
      }

      const ticketSnapshots =
        tickets.map((ticket) => {
          const requestedAmount =
            calculateTicketAmount({
              paymentAmount:
                payment.amount,
              orderTotal:
                ticket.order.total,
              orderItemTotal:
                ticket.orderItem.total,
              orderItemQuantity:
                ticket.orderItem.quantity,
            });

          return {
            ticketId: ticket.id,
            ticketCode: ticket.code,
            ticketTypeId:
              ticket.ticketType.id,
            ticketTypeName:
              ticket.ticketType.name,
            orderItemId:
              ticket.orderItemId,
            requestedAmount:
              requestedAmount.toFixed(2),
          };
        });

      const requestedAmount =
        ticketSnapshots.reduce(
          (total, ticket) =>
            total.plus(
              ticket.requestedAmount,
            ),
          new Prisma.Decimal(0),
        );

      if (
        requestedAmount.lte(0)
      ) {
        throw new ClientRefundRequestError({
          code:
            "REFUND_AMOUNT_INVALID",
          message:
            "Le montant de la demande de remboursement est invalide.",
          status: 409,
        });
      }

      const reference =
        generateRefundReference();

      const metadata =
        toJsonValue({
          schemaVersion:
            REFUND_METADATA_VERSION,
          kind:
            REFUND_METADATA_KIND,
          workflowStage:
            "ORGANIZER_REVIEW",

          customerId:
            input.customer.id,
          customerEmail,

          organizerId:
            firstTicket.event.organizerId,
          eventId:
            firstTicket.event.id,
          eventTitle:
            firstTicket.event.title,

          orderId:
            firstTicket.order.id,
          orderReference:
            firstTicket.order.reference,

          paymentId:
            payment.id,
          provider:
            payment.provider,
          providerReference:
            payment.providerReference,
          providerTransactionId:
            payment.providerTransactionId,

          ticketIds,
          tickets:
            ticketSnapshots,

          reasonCategory,
          reason,

          paidAt:
            paidAt.toISOString(),
          eligibilityDeadline:
            eligibilityDeadline.toISOString(),

          requestedAmount:
            requestedAmount.toFixed(2),
          currency:
            firstTicket.order.currency,

          submittedAt:
            now.toISOString(),
        });

      const refund =
        await transaction.paymentRefund
          .create({
            data: {
              reference,
              paymentId: payment.id,
              orderId:
                firstTicket.order.id,
              amount:
                requestedAmount,
              currency:
                firstTicket.order.currency,
              status:
                RefundStatus.PENDING,
              reason,
              requestedBy:
                input.customer.id,
              metadata,
              requestedAt: now,
            },

            select: {
              id: true,
              reference: true,
              status: true,
              requestedAt: true,
            },
          });

      return Object.freeze({
        id: refund.id,
        reference:
          refund.reference,
        status:
          refund.status,
        workflowStage:
          "ORGANIZER_REVIEW" as const,
        orderId:
          firstTicket.order.id,
        paymentId:
          payment.id,
        eventId:
          firstTicket.event.id,
        organizerId:
          firstTicket.event.organizerId,
        ticketIds:
          Object.freeze(
            [...ticketIds],
          ),
        requestedAmount:
          requestedAmount.toFixed(2),
        currency:
          firstTicket.order.currency,
        requestedAt:
          refund.requestedAt.toISOString(),
        eligibilityDeadline:
          eligibilityDeadline.toISOString(),
      });
    },
    {
      isolationLevel:
        Prisma.TransactionIsolationLevel
          .Serializable,
      maxWait: 10_000,
      timeout: 20_000,
    },
  );
}
