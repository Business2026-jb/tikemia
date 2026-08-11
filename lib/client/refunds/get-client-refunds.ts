import "server-only";

import {
  Prisma,
  RefundStatus,
} from "@prisma/client";

import {
  prisma,
} from "@/lib/prisma";

const REFUND_METADATA_KIND =
  "CLIENT_TICKET_REFUND_REQUEST";

type ClientIdentity = Readonly<{
  id: string;
  email: string;
}>;

type ParsedRefundMetadata = Readonly<{
  workflowStage: string;
  organizerId: string | null;
  eventId: string | null;
  eventTitle: string | null;
  ticketIds: readonly string[];
  tickets: readonly Readonly<{
    ticketId: string;
    ticketCode: string | null;
    ticketTypeName: string | null;
    requestedAmount: string | null;
  }>[];
  reasonCategory: string | null;
  eligibilityDeadline: string | null;
}>;

export type ClientRefund = Readonly<{
  id: string;
  reference: string;
  status: RefundStatus;
  workflowStage: string;
  reason: string | null;
  reasonCategory: string | null;
  amount: string;
  currency: string;
  requestedAt: string;
  processingAt: string | null;
  refundedAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  eligibilityDeadline: string | null;

  event: Readonly<{
    id: string | null;
    title: string | null;
    organizerId: string | null;
  }>;

  order: Readonly<{
    id: string;
    reference: string;
  }>;

  payment: Readonly<{
    id: string;
    provider: string;
    providerReference: string | null;
    providerTransactionId: string | null;
  }>;

  tickets: readonly Readonly<{
    id: string;
    code: string | null;
    ticketTypeName: string | null;
    requestedAmount: string | null;
    currentStatus: string | null;
  }>[];
}>;

function normalizeText(
  value: unknown,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function normalizeEmail(
  value: string,
): string {
  return value.trim().toLowerCase();
}

function parseRefundMetadata(
  value: Prisma.JsonValue | null,
): ParsedRefundMetadata {
  const empty: ParsedRefundMetadata = {
    workflowStage: "UNKNOWN",
    organizerId: null,
    eventId: null,
    eventTitle: null,
    ticketIds: [],
    tickets: [],
    reasonCategory: null,
    eligibilityDeadline: null,
  };

  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return empty;
  }

  const metadata =
    value as Record<
      string,
      unknown
    >;

  if (
    metadata.kind !==
    REFUND_METADATA_KIND
  ) {
    return empty;
  }

  const ticketIds =
    Array.isArray(
      metadata.ticketIds,
    )
      ? metadata.ticketIds
          .filter(
            (item): item is string =>
              typeof item === "string" &&
              Boolean(item.trim()),
          )
          .map((item) => item.trim())
      : [];

  const tickets =
    Array.isArray(metadata.tickets)
      ? metadata.tickets
          .filter(
            (
              item,
            ): item is Record<
              string,
              unknown
            > =>
              Boolean(
                item &&
                typeof item === "object" &&
                !Array.isArray(item),
              ),
          )
          .map((item) => ({
            ticketId:
              normalizeText(
                item.ticketId,
              ) ?? "",
            ticketCode:
              normalizeText(
                item.ticketCode,
              ),
            ticketTypeName:
              normalizeText(
                item.ticketTypeName,
              ),
            requestedAmount:
              normalizeText(
                item.requestedAmount,
              ),
          }))
          .filter((item) =>
            Boolean(item.ticketId),
          )
      : [];

  return {
    workflowStage:
      normalizeText(
        metadata.workflowStage,
      ) ?? "UNKNOWN",
    organizerId:
      normalizeText(
        metadata.organizerId,
      ),
    eventId:
      normalizeText(
        metadata.eventId,
      ),
    eventTitle:
      normalizeText(
        metadata.eventTitle,
      ),
    ticketIds,
    tickets,
    reasonCategory:
      normalizeText(
        metadata.reasonCategory,
      ),
    eligibilityDeadline:
      normalizeText(
        metadata.eligibilityDeadline,
      ),
  };
}

export async function getClientRefunds({
  customer,
  limit = 100,
}: {
  customer: ClientIdentity;
  limit?: number;
}): Promise<ClientRefund[]> {
  const safeLimit =
    Math.min(
      Math.max(
        Math.trunc(limit) || 1,
        1,
      ),
      200,
    );

  const customerEmail =
    normalizeEmail(customer.email);

  const refunds =
    await prisma.paymentRefund.findMany({
      where: {
        OR: [
          {
            requestedBy:
              customer.id,
          },
          {
            order: {
              customerId:
                customer.id,
            },
          },
          {
            order: {
              customerEmail: {
                equals:
                  customerEmail,
                mode:
                  Prisma.QueryMode.insensitive,
              },
            },
          },
        ],
      },

      orderBy: {
        requestedAt: "desc",
      },

      take: safeLimit,

      select: {
        id: true,
        reference: true,
        status: true,
        reason: true,
        amount: true,
        currency: true,
        metadata: true,
        requestedAt: true,
        processingAt: true,
        refundedAt: true,
        failedAt: true,
        failureReason: true,

        order: {
          select: {
            id: true,
            reference: true,
          },
        },

        payment: {
          select: {
            id: true,
            provider: true,
            providerReference: true,
            providerTransactionId:
              true,
          },
        },
      },
    });

  if (refunds.length === 0) {
    return [];
  }

  const metadataByRefundId =
    new Map<
      string,
      ParsedRefundMetadata
    >();

  const allTicketIds =
    new Set<string>();

  for (const refund of refunds) {
    const metadata =
      parseRefundMetadata(
        refund.metadata,
      );

    metadataByRefundId.set(
      refund.id,
      metadata,
    );

    for (
      const ticketId of
      metadata.ticketIds
    ) {
      allTicketIds.add(ticketId);
    }
  }

  const tickets =
    allTicketIds.size > 0
      ? await prisma.ticket.findMany({
          where: {
            id: {
              in:
                Array.from(
                  allTicketIds,
                ),
            },
          },

          select: {
            id: true,
            code: true,
            status: true,
            ticketType: {
              select: {
                name: true,
              },
            },
          },
        })
      : [];

  const currentTicketById =
    new Map(
      tickets.map((ticket) => [
        ticket.id,
        ticket,
      ] as const),
    );

  return refunds.map((refund) => {
    const metadata =
      metadataByRefundId.get(
        refund.id,
      ) ??
      parseRefundMetadata(null);

    const snapshotByTicketId =
      new Map(
        metadata.tickets.map(
          (ticket) => [
            ticket.ticketId,
            ticket,
          ] as const,
        ),
      );

    return Object.freeze({
      id: refund.id,
      reference:
        refund.reference,
      status: refund.status,
      workflowStage:
        metadata.workflowStage,
      reason: refund.reason,
      reasonCategory:
        metadata.reasonCategory,
      amount:
        refund.amount.toFixed(2),
      currency:
        refund.currency,
      requestedAt:
        refund.requestedAt.toISOString(),
      processingAt:
        refund.processingAt?.toISOString() ??
        null,
      refundedAt:
        refund.refundedAt?.toISOString() ??
        null,
      failedAt:
        refund.failedAt?.toISOString() ??
        null,
      failureReason:
        refund.failureReason,
      eligibilityDeadline:
        metadata.eligibilityDeadline,

      event: {
        id: metadata.eventId,
        title:
          metadata.eventTitle,
        organizerId:
          metadata.organizerId,
      },

      order: {
        id: refund.order.id,
        reference:
          refund.order.reference,
      },

      payment: {
        id: refund.payment.id,
        provider:
          refund.payment.provider,
        providerReference:
          refund.payment.providerReference,
        providerTransactionId:
          refund.payment.providerTransactionId,
      },

      tickets:
        metadata.ticketIds.map(
          (ticketId) => {
            const current =
              currentTicketById.get(
                ticketId,
              );

            const snapshot =
              snapshotByTicketId.get(
                ticketId,
              );

            return {
              id: ticketId,
              code:
                current?.code ??
                snapshot?.ticketCode ??
                null,
              ticketTypeName:
                current?.ticketType.name ??
                snapshot?.ticketTypeName ??
                null,
              requestedAmount:
                snapshot?.requestedAmount ??
                null,
              currentStatus:
                current?.status ?? null,
            };
          },
        ),
    });
  });
}
