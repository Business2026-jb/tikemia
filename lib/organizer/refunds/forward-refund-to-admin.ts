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

const MAX_ORGANIZER_NOTE_LENGTH =
  1_500;

export class OrganizerRefundForwardError
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
      "OrganizerRefundForwardError";
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

export async function forwardRefundToAdmin({
  organizerId,
  refundId,
  note,
  now = new Date(),
}: {
  organizerId: string;
  refundId: string;
  note?: string | null;
  now?: Date;
}): Promise<
  Readonly<{
    id: string;
    reference: string;
    status: RefundStatus;
    workflowStage:
      "FORWARDED_TO_ADMIN";
    forwardedAt: string;
    organizerNote:
      string | null;
  }>
> {
  const normalizedOrganizerId =
    organizerId.trim();

  const normalizedRefundId =
    refundId.trim();

  const organizerNote =
    normalizeText(
      note,
    );

  if (
    !normalizedOrganizerId ||
    !normalizedRefundId
  ) {
    throw new OrganizerRefundForwardError({
      code:
        "REFUND_INVALID_IDENTIFIER",
      message:
        "La demande de remboursement est invalide.",
      status:
        400,
    });
  }

  if (
    organizerNote &&
    organizerNote.length >
      MAX_ORGANIZER_NOTE_LENGTH
  ) {
    throw new OrganizerRefundForwardError({
      code:
        "REFUND_ORGANIZER_NOTE_TOO_LONG",
      message:
        `La note de l’organisateur ne peut pas dépasser ${MAX_ORGANIZER_NOTE_LENGTH} caractères.`,
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
        throw new OrganizerRefundForwardError({
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
        throw new OrganizerRefundForwardError({
          code:
            "REFUND_NOT_PENDING",
          message:
            "Cette demande ne peut plus être transmise à Tikemia.",
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
        throw new OrganizerRefundForwardError({
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
        throw new OrganizerRefundForwardError({
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
            "FORWARDED_TO_ADMIN",

          organizerDecision: {
            action:
              "FORWARDED_TO_ADMIN",
            reason:
              null,
            note:
              organizerNote,
            decidedAt:
              now.toISOString(),
            organizerId:
              normalizedOrganizerId,
          },

          forwardedToAdminAt:
            now.toISOString(),

          organizerNote,

          auditTrail: [
            ...currentAuditTrail,
            {
              action:
                "FORWARDED_TO_ADMIN",
              actorType:
                "ORGANIZER",
              actorId:
                normalizedOrganizerId,
              note:
                organizerNote,
              at:
                now.toISOString(),
            },
          ],
        });

      /*
       * IMPORTANT :
       * le statut financier reste PENDING.
       *
       * La transmission à l'admin n'est PAS un remboursement.
       * On ne passe à PROCESSING que lorsqu'un administrateur Tikemia
       * lance réellement l'opération financière auprès du prestataire.
       */
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
              metadata:
                nextMetadata,
              failureReason:
                null,
            },
          });

      if (
        updated.count !==
        1
      ) {
        throw new OrganizerRefundForwardError({
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
          RefundStatus.PENDING,
        workflowStage:
          "FORWARDED_TO_ADMIN" as const,
        forwardedAt:
          now.toISOString(),
        organizerNote,
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
