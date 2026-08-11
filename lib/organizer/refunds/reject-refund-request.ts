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

const MIN_REJECTION_REASON_LENGTH =
  10;

const MAX_REJECTION_REASON_LENGTH =
  1_500;

export class OrganizerRefundActionError
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
      "OrganizerRefundActionError";
    this.code =
      code;
    this.status =
      status;

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

function assertReason(
  value: string,
): string {
  const reason =
    value.trim();

  if (
    reason.length <
    MIN_REJECTION_REASON_LENGTH
  ) {
    throw new OrganizerRefundActionError({
      code:
        "REFUND_REJECTION_REASON_TOO_SHORT",
      message:
        `Le motif du refus doit contenir au moins ${MIN_REJECTION_REASON_LENGTH} caractères.`,
      status:
        400,
    });
  }

  if (
    reason.length >
    MAX_REJECTION_REASON_LENGTH
  ) {
    throw new OrganizerRefundActionError({
      code:
        "REFUND_REJECTION_REASON_TOO_LONG",
      message:
        `Le motif du refus ne peut pas dépasser ${MAX_REJECTION_REASON_LENGTH} caractères.`,
      status:
        400,
    });
  }

  return reason;
}

export async function rejectRefundRequest({
  organizerId,
  refundId,
  reason,
  now = new Date(),
}: {
  organizerId: string;
  refundId: string;
  reason: string;
  now?: Date;
}): Promise<
  Readonly<{
    id: string;
    reference: string;
    status: RefundStatus;
    workflowStage:
      "ORGANIZER_REJECTED";
    rejectedAt: string;
    rejectionReason: string;
  }>
> {
  const normalizedOrganizerId =
    organizerId.trim();

  const normalizedRefundId =
    refundId.trim();

  if (
    !normalizedOrganizerId ||
    !normalizedRefundId
  ) {
    throw new OrganizerRefundActionError({
      code:
        "REFUND_INVALID_IDENTIFIER",
      message:
        "La demande de remboursement est invalide.",
      status:
        400,
    });
  }

  const normalizedReason =
    assertReason(
      reason,
    );

  return prisma.$transaction(
    async (
      transaction,
    ) => {
      const refund =
        await transaction
          .paymentRefund
          .findFirst({
            where: {
              id:
                normalizedRefundId,

              order: {
                event: {
                  organizerId:
                    normalizedOrganizerId,
                },
              },
            },

            select: {
              id:
                true,
              reference:
                true,
              status:
                true,
              metadata:
                true,
            },
          });

      if (!refund) {
        throw new OrganizerRefundActionError({
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
        throw new OrganizerRefundActionError({
          code:
            "REFUND_NOT_PENDING",
          message:
            "Cette demande ne peut plus être refusée par l’organisateur.",
          status:
            409,
        });
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
        throw new OrganizerRefundActionError({
          code:
            "REFUND_INVALID_WORKFLOW",
          message:
            "Cette demande n’appartient pas au workflow de remboursement client.",
          status:
            409,
        });
      }

      const currentStage =
        normalizeText(
          metadata
            ?.workflowStage,
        );

      if (
        currentStage !==
        "ORGANIZER_REVIEW"
      ) {
        throw new OrganizerRefundActionError({
          code:
            "REFUND_ALREADY_PROCESSED_BY_ORGANIZER",
          message:
            "Cette demande a déjà été traitée par l’organisateur.",
          status:
            409,
        });
      }

      const currentAuditTrail =
        Array.isArray(
          metadata?.auditTrail,
        )
          ? metadata!.auditTrail
          : [];

      const nextMetadata =
        toJsonValue({
          ...metadata,
          workflowStage:
            "ORGANIZER_REJECTED",

          organizerDecision: {
            action:
              "REJECTED",
            reason:
              normalizedReason,
            decidedAt:
              now.toISOString(),
            organizerId:
              normalizedOrganizerId,
          },

          auditTrail: [
            ...currentAuditTrail,
            {
              action:
                "ORGANIZER_REJECTED",
              actorType:
                "ORGANIZER",
              actorId:
                normalizedOrganizerId,
              reason:
                normalizedReason,
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
                RefundStatus.CANCELLED,
              failureReason:
                normalizedReason,
              metadata:
                nextMetadata,
            },
          });

      if (
        updated.count !==
        1
      ) {
        throw new OrganizerRefundActionError({
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
          RefundStatus.CANCELLED,
        workflowStage:
          "ORGANIZER_REJECTED" as const,
        rejectedAt:
          now.toISOString(),
        rejectionReason:
          normalizedReason,
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
