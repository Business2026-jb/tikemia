import "server-only";

import {
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
      "REFUND_PROCESSING";
    approvedAt: string;
    adminNote:
      string | null;
    ticketIds:
      readonly string[];
    amount: string;
    currency: string;
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
              metadata:
                true,

              payment: {
                select: {
                  id:
                    true,
                  status:
                    true,
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
              id:
                true,
              status:
                true,
              usedAt:
                true,
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
            "REFUND_PROCESSING",

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

          /*
           * IMPORTANT :
           * cette fonction approuve administrativement la demande
           * et la place en PROCESSING.
           *
           * Elle ne marque PAS encore les billets REFUNDED et
           * ne marque PAS le Payment REFUNDED.
           *
           * Ces changements ne doivent être faits qu'après
           * confirmation réelle du remboursement par le prestataire.
           */
          providerRefundStatus:
            "PENDING_EXECUTION",

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
          ],
        });

      const updated =
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
                RefundStatus.PROCESSING,
              processingAt:
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
        updated.count !==
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

      return Object.freeze({
        id:
          refund.id,
        reference:
          refund.reference,
        status:
          RefundStatus.PROCESSING,
        workflowStage:
          "REFUND_PROCESSING" as const,
        approvedAt:
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
