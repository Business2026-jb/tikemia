import "server-only";

import {
  OrderStatus,
  PaymentStatus,
  Prisma,
  RefundStatus,
  TicketStatus,
} from "@prisma/client";

import {
  prisma,
} from "@/lib/prisma";

const CLIENT_REFUND_METADATA_KIND =
  "CLIENT_TICKET_REFUND_REQUEST";

const MAX_ADMIN_NOTE_LENGTH =
  1_500;

export class AdminRefundApprovalError
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
      "AdminRefundApprovalError";
    this.code = code;
    this.status = status;

    Object.setPrototypeOf(
      this,
      new.target.prototype,
    );
  }
}

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

function toJsonValue(
  value: unknown,
): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(value),
  ) as Prisma.InputJsonValue;
}

function readTicketIds(
  metadata:
    Record<
      string,
      unknown
    >,
): string[] {
  if (
    !Array.isArray(
      metadata.ticketIds,
    )
  ) {
    return [];
  }

  return Array.from(
    new Set(
      metadata.ticketIds
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
        ),
    ),
  );
}

export async function approveRefund({
  adminId,
  refundId,
  note,
  now = new Date(),
}: {
  adminId: string;
  refundId: string;
  note?: string | null;
  now?: Date;
}): Promise<
  Readonly<{
    id: string;
    reference: string;
    status: RefundStatus;
    workflowStage:
      "REFUNDED";
    approvedAt: string;
    refundedAt: string;
    adminNote:
      string | null;
    ticketIds:
      readonly string[];
    amount: string;
    currency: string;
    paymentStatus:
      PaymentStatus;
    orderStatus:
      OrderStatus;
    isFullRefund:
      boolean;
  }>
> {
  const normalizedAdminId =
    adminId.trim();

  const normalizedRefundId =
    refundId.trim();

  const adminNote =
    normalizeText(
      note,
    );

  if (
    !normalizedAdminId ||
    !normalizedRefundId
  ) {
    throw new AdminRefundApprovalError({
      code:
        "REFUND_INVALID_IDENTIFIER",
      message:
        "La demande de remboursement est invalide.",
      status:
        400,
    });
  }

  if (
    adminNote &&
    adminNote.length >
      MAX_ADMIN_NOTE_LENGTH
  ) {
    throw new AdminRefundApprovalError({
      code:
        "REFUND_ADMIN_NOTE_TOO_LONG",
      message:
        `La note administrateur ne peut pas dépasser ${MAX_ADMIN_NOTE_LENGTH} caractères.`,
      status:
        400,
    });
  }

  return prisma.$transaction(
    async (
      transaction,
    ) => {
      const refund =
        await transaction
          .paymentRefund
          .findUnique({
            where: {
              id:
                normalizedRefundId,
            },
            select: {
              id: true,
              reference: true,
              paymentId: true,
              orderId: true,
              status: true,
              amount: true,
              currency: true,
              metadata: true,

              payment: {
                select: {
                  id: true,
                  amount: true,
                  status: true,
                },
              },

              order: {
                select: {
                  id: true,
                  total: true,
                  status: true,
                },
              },
            },
          });

      if (!refund) {
        throw new AdminRefundApprovalError({
          code:
            "REFUND_NOT_FOUND",
          message:
            "Cette demande de remboursement est introuvable.",
          status:
            404,
        });
      }

      if (
        refund.status !==
        RefundStatus.PENDING
      ) {
        throw new AdminRefundApprovalError({
          code:
            "REFUND_NOT_PENDING",
          message:
            "Cette demande ne peut plus être approuvée.",
          status:
            409,
        });
      }

      if (
        refund.payment.status !==
          PaymentStatus.SUCCESS &&
        refund.payment.status !==
          PaymentStatus.PARTIALLY_REFUNDED
      ) {
        throw new AdminRefundApprovalError({
          code:
            "PAYMENT_NOT_REFUNDABLE",
          message:
            "Le paiement associé n’est pas dans un état permettant ce remboursement.",
          status:
            409,
        });
      }

      const metadata =
        readObject(
          refund.metadata,
        );

      if (
        !metadata ||
        normalizeText(
          metadata.kind,
        ) !==
          CLIENT_REFUND_METADATA_KIND
      ) {
        throw new AdminRefundApprovalError({
          code:
            "REFUND_INVALID_WORKFLOW",
          message:
            "Cette demande n’appartient pas au workflow de remboursement client.",
          status:
            409,
        });
      }

      const workflowStage =
        normalizeText(
          metadata.workflowStage,
        );

      if (
        workflowStage !==
          "FORWARDED_TO_ADMIN" &&
        workflowStage !==
          "ADMIN_REVIEW"
      ) {
        throw new AdminRefundApprovalError({
          code:
            "REFUND_NOT_READY_FOR_ADMIN_APPROVAL",
          message:
            "Cette demande doit d’abord être transmise à Tikemia par l’organisateur.",
          status:
            409,
        });
      }

      const ticketIds =
        readTicketIds(
          metadata,
        );

      if (
        ticketIds.length ===
        0
      ) {
        throw new AdminRefundApprovalError({
          code:
            "REFUND_TICKETS_MISSING",
          message:
            "Aucun billet n’est associé à cette demande.",
          status:
            409,
        });
      }

      const tickets =
        await transaction.ticket
          .findMany({
            where: {
              id: {
                in:
                  ticketIds,
              },
            },
            select: {
              id: true,
              status: true,
              usedAt: true,
            },
          });

      if (
        tickets.length !==
        ticketIds.length
      ) {
        throw new AdminRefundApprovalError({
          code:
            "REFUND_TICKETS_NOT_FOUND",
          message:
            "Un ou plusieurs billets de la demande sont introuvables.",
          status:
            409,
        });
      }

      for (
        const ticket of tickets
      ) {
        if (
          ticket.usedAt ||
          ticket.status ===
            TicketStatus.USED
        ) {
          throw new AdminRefundApprovalError({
            code:
              "REFUND_TICKET_ALREADY_USED",
            message:
              "Un billet déjà utilisé ne peut pas être remboursé.",
            status:
              409,
          });
        }

        if (
          ticket.status !==
          TicketStatus.VALID
        ) {
          throw new AdminRefundApprovalError({
            code:
              "REFUND_TICKET_NOT_VALID",
            message:
              "Un ou plusieurs billets ne sont plus dans un état remboursable.",
            status:
              409,
          });
        }
      }

      const previousSuccessfulRefunds =
        await transaction
          .paymentRefund
          .aggregate({
            where: {
              paymentId:
                refund.paymentId,
              status:
                RefundStatus.SUCCESS,
              id: {
                not:
                  refund.id,
              },
            },
            _sum: {
              amount:
                true,
            },
          });

      const alreadyRefundedAmount =
        previousSuccessfulRefunds
          ._sum.amount ??
        new Prisma.Decimal(0);

      const totalRefundedAmount =
        alreadyRefundedAmount.add(
          refund.amount,
        );

      if (
        totalRefundedAmount.gt(
          refund.payment.amount,
        )
      ) {
        throw new AdminRefundApprovalError({
          code:
            "REFUND_AMOUNT_EXCEEDS_PAYMENT",
          message:
            "Le montant total des remboursements dépasse le montant du paiement.",
          status:
            409,
        });
      }

      const isFullRefund =
        totalRefundedAmount.gte(
          refund.payment.amount,
        );

      const nextPaymentStatus =
        isFullRefund
          ? PaymentStatus.REFUNDED
          : PaymentStatus.PARTIALLY_REFUNDED;

      const nextOrderStatus =
        isFullRefund
          ? OrderStatus.REFUNDED
          : OrderStatus.PARTIALLY_REFUNDED;

      const currentAuditTrail =
        Array.isArray(
          metadata.auditTrail,
        )
          ? metadata.auditTrail
          : [];

      const nextMetadata =
        toJsonValue({
          ...metadata,

          workflowStage:
            "REFUNDED",

          adminDecision: {
            action:
              "APPROVED",
            reason:
              null,
            note:
              adminNote,
            decidedAt:
              now.toISOString(),
            adminId:
              normalizedAdminId,
          },

          approvedByAdminAt:
            now.toISOString(),

          refundedAt:
            now.toISOString(),

          finalizationSource:
            "ADMIN_APPROVAL",

          auditTrail: [
            ...currentAuditTrail,
            {
              action:
                "ADMIN_APPROVED",
              actorType:
                "ADMIN",
              actorId:
                normalizedAdminId,
              note:
                adminNote,
              at:
                now.toISOString(),
            },
            {
              action:
                "REFUND_COMPLETED",
              actorType:
                "ADMIN",
              actorId:
                normalizedAdminId,
              note:
                "Remboursement validé définitivement dans Tikemia.",
              at:
                now.toISOString(),
            },
          ],
        });

      const updatedRefund =
        await transaction
          .paymentRefund
          .updateMany({
            where: {
              id:
                refund.id,
              status:
                RefundStatus.PENDING,
            },
            data: {
              status:
                RefundStatus.SUCCESS,
              processingAt:
                now,
              refundedAt:
                now,
              failedAt:
                null,
              failureReason:
                null,
              metadata:
                nextMetadata,
            },
          });

      if (
        updatedRefund.count !==
        1
      ) {
        throw new AdminRefundApprovalError({
          code:
            "REFUND_CONCURRENT_UPDATE",
          message:
            "La demande vient d’être modifiée. Actualisez la page et réessayez.",
          status:
            409,
        });
      }

      const updatedTickets =
        await transaction.ticket
          .updateMany({
            where: {
              id: {
                in:
                  ticketIds,
              },
              status:
                TicketStatus.VALID,
              usedAt:
                null,
            },
            data: {
              status:
                TicketStatus.REFUNDED,
              revokedAt:
                now,
              revocationReason:
                "Billet remboursé après validation de la demande par Tikemia.",
            },
          });

      if (
        updatedTickets.count !==
        ticketIds.length
      ) {
        throw new AdminRefundApprovalError({
          code:
            "REFUND_TICKETS_CONCURRENT_UPDATE",
          message:
            "Un ou plusieurs billets viennent d’être modifiés. Le remboursement n’a pas été finalisé.",
          status:
            409,
        });
      }

      await transaction.payment
        .update({
          where: {
            id:
              refund.payment.id,
          },
          data: isFullRefund
            ? {
                status:
                  nextPaymentStatus,
                refundedAt:
                  now,
              }
            : {
                status:
                  nextPaymentStatus,
              },
        });

      await transaction.order
        .update({
          where: {
            id:
              refund.order.id,
          },
          data: isFullRefund
            ? {
                status:
                  nextOrderStatus,
                refundedAt:
                  now,
              }
            : {
                status:
                  nextOrderStatus,
              },
        });

      return Object.freeze({
        id:
          refund.id,
        reference:
          refund.reference,
        status:
          RefundStatus.SUCCESS,
        workflowStage:
          "REFUNDED" as const,
        approvedAt:
          now.toISOString(),
        refundedAt:
          now.toISOString(),
        adminNote,
        ticketIds:
          Object.freeze(
            [...ticketIds],
          ),
        amount:
          refund.amount
            .toFixed(2),
        currency:
          refund.currency,
        paymentStatus:
          nextPaymentStatus,
        orderStatus:
          nextOrderStatus,
        isFullRefund,
      });
    },
    {
      isolationLevel:
        Prisma
          .TransactionIsolationLevel
          .Serializable,
      maxWait:
        10_000,
      timeout:
        20_000,
    },
  );
}