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

export type OrganizerRefundWorkflowStage =
  | "ORGANIZER_REVIEW"
  | "ORGANIZER_REJECTED"
  | "FORWARDED_TO_ADMIN"
  | "ADMIN_REVIEW"
  | "ADMIN_REJECTED"
  | "REFUND_PROCESSING"
  | "REFUNDED"
  | "REFUND_FAILED"
  | "CANCELLED"
  | "UNKNOWN";

export type OrganizerRefundListItem =
  Readonly<{
    id: string;
    reference: string;
    status: RefundStatus;
    workflowStage:
      OrganizerRefundWorkflowStage;

    amount: string;
    currency: string;
    reason: string | null;
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

    event: Readonly<{
      id: string;
      title: string;
      slug: string;
      startsAt: string;
      endsAt: string | null;
    }>;

    order: Readonly<{
      id: string;
      reference: string;
      paidAt: string | null;
    }>;

    payment: Readonly<{
      id: string;
      provider: string;
      providerReference:
        string | null;
      providerTransactionId:
        string | null;
      paidAt: string | null;
    }>;

    tickets: readonly Readonly<{
      id: string;
      code: string | null;
      ticketTypeName:
        string | null;
      requestedAmount:
        string | null;
      currentStatus:
        string | null;
    }>[];
  }>;

export type OrganizerRefundFilters =
  Readonly<{
    workflowStage?:
      OrganizerRefundWorkflowStage |
      "ALL";
    search?:
      string | null;
    limit?: number;
  }>;

type ParsedMetadata =
  Readonly<{
    kind:
      string | null;
    workflowStage:
      OrganizerRefundWorkflowStage;
    reasonCategory:
      string | null;
    ticketIds:
      readonly string[];
    tickets:
      readonly Readonly<{
        ticketId: string;
        ticketCode:
          string | null;
        ticketTypeName:
          string | null;
        requestedAmount:
          string | null;
      }>[];
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

function normalizeWorkflowStage(
  value: unknown,
): OrganizerRefundWorkflowStage {
  const normalized =
    normalizeText(
      value,
    );

  switch (
    normalized
  ) {
    case "ORGANIZER_REVIEW":
    case "ORGANIZER_REJECTED":
    case "FORWARDED_TO_ADMIN":
    case "ADMIN_REVIEW":
    case "ADMIN_REJECTED":
    case "REFUND_PROCESSING":
    case "REFUNDED":
    case "REFUND_FAILED":
    case "CANCELLED":
      return normalized;

    default:
      return "UNKNOWN";
  }
}

function parseMetadata(
  value:
    Prisma.JsonValue | null,
): ParsedMetadata {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value,
    )
  ) {
    return {
      kind:
        null,
      workflowStage:
        "UNKNOWN",
      reasonCategory:
        null,
      ticketIds:
        [],
      tickets:
        [],
    };
  }

  const metadata =
    value as Record<
      string,
      unknown
    >;

  const ticketIds =
    Array.isArray(
      metadata.ticketIds,
    )
      ? metadata.ticketIds
          .filter(
            (
              item,
            ): item is string =>
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

  const tickets =
    Array.isArray(
      metadata.tickets,
    )
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
                typeof item ===
                  "object" &&
                !Array.isArray(
                  item,
                ),
              ),
          )
          .map(
            (item) => ({
              ticketId:
                normalizeText(
                  item.ticketId,
                ) ??
                "",
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
            }),
          )
          .filter(
            (item) =>
              Boolean(
                item.ticketId,
              ),
          )
      : [];

  return {
    kind:
      normalizeText(
        metadata.kind,
      ),
    workflowStage:
      normalizeWorkflowStage(
        metadata.workflowStage,
      ),
    reasonCategory:
      normalizeText(
        metadata.reasonCategory,
      ),
    ticketIds,
    tickets,
  };
}

function normalizeSearch(
  value:
    string | null | undefined,
): string | null {
  const normalized =
    value?.trim() ?? "";

  return normalized
    .slice(
      0,
      200,
    ) ||
    null;
}

export async function getOrganizerRefunds({
  organizerId,
  filters = {},
}: {
  organizerId: string;
  filters?:
    OrganizerRefundFilters;
}): Promise<
  OrganizerRefundListItem[]
> {
  const normalizedOrganizerId =
    organizerId.trim();

  if (
    !normalizedOrganizerId
  ) {
    return [];
  }

  const search =
    normalizeSearch(
      filters.search,
    );

  const safeLimit =
    Math.min(
      Math.max(
        Math.trunc(
          filters.limit ??
            100,
        ) ||
          1,
        1,
      ),
      200,
    );

  const refunds =
    await prisma.paymentRefund
      .findMany({
        where: {
          order: {
            event: {
              organizerId:
                normalizedOrganizerId,
            },
          },

          ...(search
            ? {
                OR: [
                  {
                    reference: {
                      contains:
                        search,
                      mode:
                        Prisma
                          .QueryMode
                          .insensitive,
                    },
                  },
                  {
                    order: {
                      reference: {
                        contains:
                          search,
                        mode:
                          Prisma
                            .QueryMode
                            .insensitive,
                      },
                    },
                  },
                  {
                    order: {
                      customerName: {
                        contains:
                          search,
                        mode:
                          Prisma
                            .QueryMode
                            .insensitive,
                      },
                    },
                  },
                  {
                    order: {
                      customerEmail: {
                        contains:
                          search,
                        mode:
                          Prisma
                            .QueryMode
                            .insensitive,
                      },
                    },
                  },
                  {
                    order: {
                      event: {
                        title: {
                          contains:
                            search,
                          mode:
                            Prisma
                              .QueryMode
                              .insensitive,
                        },
                      },
                    },
                  },
                ],
              }
            : {}),
        },

        orderBy: {
          requestedAt:
            "desc",
        },

        take:
          safeLimit,

        select: {
          id:
            true,
          reference:
            true,
          status:
            true,
          amount:
            true,
          currency:
            true,
          reason:
            true,
          metadata:
            true,
          requestedAt:
            true,
          processingAt:
            true,
          refundedAt:
            true,
          failedAt:
            true,
          failureReason:
            true,

          payment: {
            select: {
              id:
                true,
              provider:
                true,
              providerReference:
                true,
              providerTransactionId:
                true,
              paidAt:
                true,
            },
          },

          order: {
            select: {
              id:
                true,
              reference:
                true,
              customerId:
                true,
              customerName:
                true,
              customerEmail:
                true,
              customerPhone:
                true,
              paidAt:
                true,

              event: {
                select: {
                  id:
                    true,
                  title:
                    true,
                  slug:
                    true,
                  startsAt:
                    true,
                  endsAt:
                    true,
                },
              },
            },
          },
        },
      });

  if (
    refunds.length ===
    0
  ) {
    return [];
  }

  const metadataByRefundId =
    new Map<
      string,
      ParsedMetadata
    >();

  const allTicketIds =
    new Set<string>();

  for (
    const refund of
    refunds
  ) {
    const metadata =
      parseMetadata(
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
      allTicketIds.add(
        ticketId,
      );
    }
  }

  const tickets =
    allTicketIds.size > 0
      ? await prisma.ticket
          .findMany({
            where: {
              id: {
                in:
                  Array.from(
                    allTicketIds,
                  ),
              },
            },

            select: {
              id:
                true,
              code:
                true,
              status:
                true,

              ticketType: {
                select: {
                  name:
                    true,
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

  return refunds
    .filter(
      (refund) => {
        const metadata =
          metadataByRefundId.get(
            refund.id,
          );

        if (
          metadata?.kind !==
          CLIENT_REFUND_METADATA_KIND
        ) {
          return false;
        }

        const requestedStage =
          filters.workflowStage ??
          "ALL";

        return (
          requestedStage ===
            "ALL" ||
          metadata.workflowStage ===
            requestedStage
        );
      },
    )
    .map(
      (refund) => {
        const metadata =
          metadataByRefundId.get(
            refund.id,
          )!;

        const snapshotById =
          new Map(
            metadata.tickets.map(
              (ticket) => [
                ticket.ticketId,
                ticket,
              ] as const,
            ),
          );

        return Object.freeze({
          id:
            refund.id,
          reference:
            refund.reference,
          status:
            refund.status,
          workflowStage:
            metadata.workflowStage,
          amount:
            refund.amount
              .toFixed(2),
          currency:
            refund.currency,
          reason:
            refund.reason,
          reasonCategory:
            metadata
              .reasonCategory,
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
          },

          order: {
            id:
              refund.order.id,
            reference:
              refund.order
                .reference,
            paidAt:
              refund.order
                .paidAt
                ?.toISOString() ??
              null,
          },

          payment: {
            id:
              refund.payment.id,
            provider:
              refund.payment
                .provider,
            providerReference:
              refund.payment
                .providerReference,
            providerTransactionId:
              refund.payment
                .providerTransactionId,
            paidAt:
              refund.payment
                .paidAt
                ?.toISOString() ??
              null,
          },

          tickets:
            metadata.ticketIds.map(
              (
                ticketId,
              ) => {
                const current =
                  ticketById.get(
                    ticketId,
                  );

                const snapshot =
                  snapshotById.get(
                    ticketId,
                  );

                return {
                  id:
                    ticketId,
                  code:
                    current?.code ??
                    snapshot
                      ?.ticketCode ??
                    null,
                  ticketTypeName:
                    current
                      ?.ticketType
                      .name ??
                    snapshot
                      ?.ticketTypeName ??
                    null,
                  requestedAmount:
                    snapshot
                      ?.requestedAmount ??
                    null,
                  currentStatus:
                    current
                      ?.status ??
                    null,
                };
              },
            ),
        });
      },
    );
}
