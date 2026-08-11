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

export class AdminRefundRejectionError
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
      "AdminRefundRejectionError";
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

function assertReason(
  value: string,
): string {
  const reason =
    value.trim();

  if (
    reason.length <
    MIN_REJECTION_REASON_LENGTH
  ) {
    throw new AdminRefundRejectionError({
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
    throw new AdminRefundRejectionError({
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

export async function rejectRefund({
  adminId,
  refundId,
  reason,
  now = new Date(),
}: {
  adminId: string;
  refundId: string;
  reason: string;
  now?: Date;
}): Promise<
  Readonly<{
    id: string;
    reference: string;
    status: RefundStatus;
    workflowStage:
      "ADMIN_REJECTED";
    rejectedAt: string;
    rejectionReason: string;
  }>
> {
  const normalizedAdminId =
    adminId.trim();

  const normalizedRefundId =
    refundId.trim();

  const normalizedReason =
    assertReason(
      reason,
    );

  if (
    !normalizedAdminId ||
    !normalizedRefundId
  ) {
    throw new AdminRefundRejectionError({
      code:
        "REFUND_INVALID_IDENTIFIER",
      message:
        "La demande de remboursement est invalide.",
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
              metadata:
                true,
            },
          });

      if (!refund) {
        throw new AdminRefundRejectionError({
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
        throw new AdminRefundRejectionError({
          code:
            "REFUND_NOT_PENDING",
          message:
            "Cette demande ne peut plus être rejetée.",
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
        throw new AdminRefundRejectionError({
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
        throw new AdminRefundRejectionError({
          code:
            "REFUND_NOT_READY_FOR_ADMIN_REJECTION",
          message:
            "Cette demande n’est pas dans un état permettant une décision Tikemia.",
          status:
            409,
        });
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
            "ADMIN_REJECTED",

          adminDecision: {
            action:
              "REJECTED",
            reason:
              normalizedReason,
            note:
              null,
            decidedAt:
              now.toISOString(),
            adminId:
              normalizedAdminId,
          },

          rejectedByAdminAt:
            now.toISOString(),

          auditTrail: [
            ...currentAuditTrail,
            {
              action:
                "ADMIN_REJECTED",
              actorType:
                "ADMIN",
              actorId:
                normalizedAdminId,
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
              failedAt:
                null,
              metadata:
                nextMetadata,
            },
          });

      if (
        updated.count !==
        1
      ) {
        throw new AdminRefundRejectionError({
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
          "ADMIN_REJECTED" as const,
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
