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

export type AdminRefundWorkflowStage =
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

export type AdminRefundFilters =
  Readonly<{
    workflowStage?:
      AdminRefundWorkflowStage |
      "ALL";
    status?:
      RefundStatus |
      "ALL";
    search?:
      string | null;
    limit?: number;
  }>;

export type AdminRefundListItem =
  Readonly<{
    id: string;
    reference: string;
    status: RefundStatus;
    workflowStage:
      AdminRefundWorkflowStage;

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
      endsAt: string | null;
    }>;

    order: Readonly<{
      id: string;
      reference: string;
      status: string;
      paidAt: string | null;
    }>;

    payment: Readonly<{
      id: string;
      provider: string;
      status: string;
      providerReference:
        string | null;
      providerTransactionId:
        string | null;
      paidAt:
        string | null;
    }>;

    ticketCount: number;
  }>;

type ParsedMetadata =
  Readonly<{
    kind: string | null;
    workflowStage:
      AdminRefundWorkflowStage;
    reasonCategory:
      string | null;
    ticketIds:
      readonly string[];
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
): AdminRefundWorkflowStage {
  const normalized =
    normalizeText(value);

  switch (normalized) {
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
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {
      kind: null,
      workflowStage:
        "UNKNOWN",
      reasonCategory:
        null,
      ticketIds: [],
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

export async function getAdminRefunds({
  filters = {},
}: {
  filters?:
    AdminRefundFilters;
} = {}): Promise<
  AdminRefundListItem[]
> {
  const search =
    normalizeSearch(
      filters.search,
    );

  const safeLimit =
    Math.min(
      Math.max(
        Math.trunc(
          filters.limit ?? 100,
        ) || 1,
        1,
      ),
      300,
    );

  const refunds =
    await prisma.paymentRefund
      .findMany({
        where: {
          ...(filters.status &&
          filters.status !== "ALL"
            ? {
                status:
                  filters.status,
              }
            : {}),

          ...(search
            ? {
                OR: [
                  {
                    reference: {
                      contains:
                        search,
                      mode:
                        Prisma.QueryMode
                          .insensitive,
                    },
                  },
                  {
                    order: {
                      reference: {
                        contains:
                          search,
                        mode:
                          Prisma.QueryMode
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
                          Prisma.QueryMode
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
                          Prisma.QueryMode
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
                            Prisma.QueryMode
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
              status: true,
              providerReference: true,
              providerTransactionId:
                true,
              paidAt: true,
            },
          },

          order: {
            select: {
              id: true,
              reference: true,
              status: true,
              paidAt: true,
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

  return refunds
    .map((refund) => ({
      refund,
      metadata:
        parseMetadata(
          refund.metadata,
        ),
    }))
    .filter(({ metadata }) => {
      if (
        metadata.kind !==
        CLIENT_REFUND_METADATA_KIND
      ) {
        return false;
      }

      const stage =
        filters.workflowStage ??
        "ALL";

      return (
        stage === "ALL" ||
        metadata.workflowStage ===
          stage
      );
    })
    .map(
      ({
        refund,
        metadata,
      }) => {
        const organizer =
          refund.order.event
            .organizer;

        const organizerName =
          `${organizer.firstName} ${organizer.lastName}`.trim();

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
            refund.amount.toFixed(2),
          currency:
            refund.currency,
          reason:
            refund.reason,
          reasonCategory:
            metadata.reasonCategory,

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
          },

          order: {
            id:
              refund.order.id,
            reference:
              refund.order
                .reference,
            status:
              refund.order.status,
            paidAt:
              refund.order.paidAt
                ?.toISOString() ??
              null,
          },

          payment: {
            id:
              refund.payment.id,
            provider:
              refund.payment
                .provider,
            status:
              refund.payment
                .status,
            providerReference:
              refund.payment
                .providerReference,
            providerTransactionId:
              refund.payment
                .providerTransactionId,
            paidAt:
              refund.payment.paidAt
                ?.toISOString() ??
              null,
          },

          ticketCount:
            metadata.ticketIds
              .length,
        });
      },
    );
}
