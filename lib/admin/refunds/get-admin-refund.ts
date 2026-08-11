import "server-only";

import {
  Prisma,
  RefundStatus,
} from "@prisma/client";

import {
  prisma,
} from "@/lib/prisma";

const CLIENT_REFUND_METADATA_KIND =
  "CLIENT_TICKET_REFUND_REQUEST";

export type AdminRefundDetail =
  Readonly<{
    id: string;
    reference: string;
    status: RefundStatus;
    workflowStage: string;

    amount: string;
    currency: string;
    reason:
      string | null;
    reasonCategory:
      string | null;

    requestedAt: string;
    processingAt:
      string | null;
    refundedAt:
      string | null;
    failedAt:
      string | null;
    failureReason:
      string | null;

    customer: Readonly<{
      id: string | null;
      name: string;
      email: string;
      phone: string;
    }>;

    organizer: Readonly<{
      id: string;
      name: string;
      email: string;
    }>;

    event: Readonly<{
      id: string;
      title: string;
      slug: string;
      startsAt: string;
      endsAt:
        string | null;
      organizerId: string;
    }>;

    order: Readonly<{
      id: string;
      reference: string;
      status: string;
      subtotal: string;
      platformFee: string;
      total: string;
      currency: string;
      paidAt:
        string | null;
      refundedAt:
        string | null;
    }>;

    payment: Readonly<{
      id: string;
      provider: string;
      method: string;
      status: string;
      amount: string;
      currency: string;
      providerReference:
        string | null;
      providerTransactionId:
        string | null;
      initiatedAt: string;
      paidAt:
        string | null;
      refundedAt:
        string | null;
    }>;

    organizerDecision:
      Readonly<{
        action:
          string | null;
        reason:
          string | null;
        note:
          string | null;
        decidedAt:
          string | null;
        organizerId:
          string | null;
      }>;

    adminDecision:
      Readonly<{
        action:
          string | null;
        reason:
          string | null;
        note:
          string | null;
        decidedAt:
          string | null;
        adminId:
          string | null;
      }>;

    tickets:
      readonly Readonly<{
        id: string;
        code:
          string | null;
        currentStatus:
          string | null;
        holderName:
          string | null;
        holderEmail:
          string | null;
        holderPhone:
          string | null;
        usedAt:
          string | null;
        scannedAt:
          string | null;
        ticketTypeId:
          string | null;
        ticketTypeName:
          string | null;
        requestedAmount:
          string | null;
      }>[];

    auditTrail:
      readonly unknown[];
  }>;

function normalizeText(
  value: unknown,
): string | null {
  if (
    typeof value !==
    "string"
  ) {
    return null;
  }

  const normalized =
    value.trim();

  return normalized ||
    null;
}

function readObject(
  value: unknown,
): Record<
  string,
  unknown
> | null {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as Record<
    string,
    unknown
  >;
}

export async function getAdminRefund({
  refundId,
}: {
  refundId: string;
}): Promise<
  AdminRefundDetail | null
> {
  const normalizedRefundId =
    refundId.trim();

  if (!normalizedRefundId) {
    return null;
  }

  const refund =
    await prisma.paymentRefund
      .findUnique({
        where: {
          id:
            normalizedRefundId,
        },

        select: {
          id: true,
          reference: true,
          status: true,
          amount: true,
          currency: true,
          reason: true,
          metadata: true,
          requestedAt: true,
          processingAt: true,
          refundedAt: true,
          failedAt: true,
          failureReason: true,

          payment: {
            select: {
              id: true,
              provider: true,
              method: true,
              status: true,
              amount: true,
              currency: true,
              providerReference:
                true,
              providerTransactionId:
                true,
              initiatedAt: true,
              paidAt: true,
              refundedAt: true,
            },
          },

          order: {
            select: {
              id: true,
              reference: true,
              status: true,
              subtotal: true,
              platformFee: true,
              total: true,
              currency: true,
              paidAt: true,
              refundedAt: true,
              customerId: true,
              customerName: true,
              customerEmail: true,
              customerPhone: true,

              event: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  startsAt: true,
                  endsAt: true,
                  organizerId: true,

                  organizer: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      email: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

  if (!refund) {
    return null;
  }

  const metadata =
    readObject(
      refund.metadata,
    );

  if (
    normalizeText(
      metadata?.kind,
    ) !==
    CLIENT_REFUND_METADATA_KIND
  ) {
    return null;
  }

  const ticketIds =
    Array.isArray(
      metadata?.ticketIds,
    )
      ? metadata!.ticketIds
          .filter(
            (item): item is string =>
              typeof item ===
                "string" &&
              Boolean(
                item.trim(),
              ),
          )
          .map(
            (item) =>
              item.trim(),
          )
      : [];

  const snapshotTickets =
    Array.isArray(
      metadata?.tickets,
    )
      ? metadata!.tickets
          .map(
            (item) =>
              readObject(
                item,
              ),
          )
          .filter(
            (
              item,
            ): item is Record<
              string,
              unknown
            > =>
              Boolean(item),
          )
      : [];

  const snapshotsById =
    new Map(
      snapshotTickets
        .map(
          (item) => [
            normalizeText(
              item.ticketId,
            ),
            item,
          ] as const,
        )
        .filter(
          (
            entry,
          ): entry is readonly [
            string,
            Record<
              string,
              unknown
            >,
          ] =>
            Boolean(
              entry[0],
            ),
        ),
    );

  const tickets =
    ticketIds.length > 0
      ? await prisma.ticket
          .findMany({
            where: {
              id: {
                in:
                  ticketIds,
              },
            },

            select: {
              id: true,
              code: true,
              status: true,
              holderName: true,
              holderEmail: true,
              holderPhone: true,
              usedAt: true,
              scannedAt: true,

              ticketType: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          })
      : [];

  const ticketById =
    new Map(
      tickets.map(
        (ticket) => [
          ticket.id,
          ticket,
        ] as const,
      ),
    );

  const organizerDecision =
    readObject(
      metadata
        ?.organizerDecision,
    );

  const adminDecision =
    readObject(
      metadata
        ?.adminDecision,
    );

  const organizer =
    refund.order.event
      .organizer;

  const organizerName =
    `${organizer.firstName} ${organizer.lastName}`.trim();

  const auditTrail =
    Array.isArray(
      metadata?.auditTrail,
    )
      ? metadata!.auditTrail
      : [];

  return Object.freeze({
    id:
      refund.id,
    reference:
      refund.reference,
    status:
      refund.status,
    workflowStage:
      normalizeText(
        metadata
          ?.workflowStage,
      ) ??
      "UNKNOWN",

    amount:
      refund.amount
        .toFixed(2),
    currency:
      refund.currency,
    reason:
      refund.reason,
    reasonCategory:
      normalizeText(
        metadata
          ?.reasonCategory,
      ),

    requestedAt:
      refund.requestedAt
        .toISOString(),
    processingAt:
      refund.processingAt
        ?.toISOString() ??
      null,
    refundedAt:
      refund.refundedAt
        ?.toISOString() ??
      null,
    failedAt:
      refund.failedAt
        ?.toISOString() ??
      null,
    failureReason:
      refund.failureReason,

    customer: {
      id:
        refund.order
          .customerId,
      name:
        refund.order
          .customerName,
      email:
        refund.order
          .customerEmail,
      phone:
        refund.order
          .customerPhone,
    },

    organizer: {
      id:
        organizer.id,
      name:
        organizerName ||
        organizer.email,
      email:
        organizer.email,
    },

    event: {
      id:
        refund.order
          .event.id,
      title:
        refund.order
          .event.title,
      slug:
        refund.order
          .event.slug,
      startsAt:
        refund.order
          .event.startsAt
          .toISOString(),
      endsAt:
        refund.order
          .event.endsAt
          ?.toISOString() ??
        null,
      organizerId:
        refund.order
          .event.organizerId,
    },

    order: {
      id:
        refund.order.id,
      reference:
        refund.order
          .reference,
      status:
        refund.order.status,
      subtotal:
        refund.order.subtotal
          .toFixed(2),
      platformFee:
        refund.order
          .platformFee
          .toFixed(2),
      total:
        refund.order.total
          .toFixed(2),
      currency:
        refund.order.currency,
      paidAt:
        refund.order.paidAt
          ?.toISOString() ??
        null,
      refundedAt:
        refund.order.refundedAt
          ?.toISOString() ??
        null,
    },

    payment: {
      id:
        refund.payment.id,
      provider:
        refund.payment.provider,
      method:
        refund.payment.method,
      status:
        refund.payment.status,
      amount:
        refund.payment.amount
          .toFixed(2),
      currency:
        refund.payment.currency,
      providerReference:
        refund.payment
          .providerReference,
      providerTransactionId:
        refund.payment
          .providerTransactionId,
      initiatedAt:
        refund.payment
          .initiatedAt
          .toISOString(),
      paidAt:
        refund.payment.paidAt
          ?.toISOString() ??
        null,
      refundedAt:
        refund.payment.refundedAt
          ?.toISOString() ??
        null,
    },

    organizerDecision: {
      action:
        normalizeText(
          organizerDecision
            ?.action,
        ),
      reason:
        normalizeText(
          organizerDecision
            ?.reason,
        ),
      note:
        normalizeText(
          organizerDecision
            ?.note,
        ),
      decidedAt:
        normalizeText(
          organizerDecision
            ?.decidedAt,
        ),
      organizerId:
        normalizeText(
          organizerDecision
            ?.organizerId,
        ),
    },

    adminDecision: {
      action:
        normalizeText(
          adminDecision
            ?.action,
        ),
      reason:
        normalizeText(
          adminDecision
            ?.reason,
        ),
      note:
        normalizeText(
          adminDecision
            ?.note,
        ),
      decidedAt:
        normalizeText(
          adminDecision
            ?.decidedAt,
        ),
      adminId:
        normalizeText(
          adminDecision
            ?.adminId,
        ),
    },

    tickets:
      ticketIds.map(
        (ticketId) => {
          const current =
            ticketById.get(
              ticketId,
            );

          const snapshot =
            snapshotsById.get(
              ticketId,
            );

          return {
            id:
              ticketId,
            code:
              current?.code ??
              normalizeText(
                snapshot
                  ?.ticketCode,
              ),
            currentStatus:
              current?.status ??
              null,
            holderName:
              current
                ?.holderName ??
              null,
            holderEmail:
              current
                ?.holderEmail ??
              null,
            holderPhone:
              current
                ?.holderPhone ??
              null,
            usedAt:
              current?.usedAt
                ?.toISOString() ??
              null,
            scannedAt:
              current
                ?.scannedAt
                ?.toISOString() ??
              null,
            ticketTypeId:
              current
                ?.ticketType
                .id ??
              normalizeText(
                snapshot
                  ?.ticketTypeId,
              ),
            ticketTypeName:
              current
                ?.ticketType
                .name ??
              normalizeText(
                snapshot
                  ?.ticketTypeName,
              ),
            requestedAmount:
              normalizeText(
                snapshot
                  ?.requestedAmount,
              ),
          };
        },
      ),

    auditTrail:
      Object.freeze(
        [...auditTrail],
      ),
  });
}
