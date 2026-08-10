import "server-only";

import {
  OrderStatus,
  PayoutStatus,
  Prisma,
  UserRole,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type DeleteOrganizerInput = {
  organizerId: string;
  confirmationEmail: string;
  permanent?: boolean;
};

export type DeleteOrganizerResult = {
  organizerId: string;
  email: string;
  action: "DEACTIVATED" | "DELETED";
  deactivatedAt: Date | null;
  deletedAt: Date | null;
};

export class DeleteOrganizerError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    status: number,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "DeleteOrganizerError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export async function deleteOrganizer(
  input: DeleteOrganizerInput,
): Promise<DeleteOrganizerResult> {
  const organizerId = input.organizerId.trim();
  const confirmationEmail =
    input.confirmationEmail.trim().toLowerCase();
  const permanent = input.permanent === true;

  if (!organizerId || !confirmationEmail) {
    throw new DeleteOrganizerError(
      "Organizer id and confirmation email are required.",
      "INVALID_INPUT",
      400,
    );
  }

  return prisma.$transaction(
    async (tx) => {
      const organizer = await tx.user.findFirst({
        where: {
          id: organizerId,
          role: UserRole.ORGANIZER,
        },
        select: {
          id: true,
          email: true,
          isActive: true,
        },
      });

      if (!organizer) {
        throw new DeleteOrganizerError(
          "Organizer not found.",
          "ORGANIZER_NOT_FOUND",
          404,
        );
      }

      if (
        organizer.email.toLowerCase() !==
        confirmationEmail
      ) {
        throw new DeleteOrganizerError(
          "Confirmation email does not match the organizer.",
          "CONFIRMATION_EMAIL_MISMATCH",
          400,
        );
      }

      if (!permanent) {
        const deactivatedAt = new Date();

        await tx.session.deleteMany({
          where: { userId: organizer.id },
        });

        await tx.eventScanner.updateMany({
          where: {
            scannerId: organizer.id,
            isActive: true,
          },
          data: {
            isActive: false,
            revokedAt: deactivatedAt,
          },
        });

        await tx.eventScanner.updateMany({
          where: {
            createdById: organizer.id,
            isActive: true,
          },
          data: {
            isActive: false,
            revokedAt: deactivatedAt,
          },
        });

        await tx.user.update({
          where: { id: organizer.id },
          data: { isActive: false },
        });

        return {
          organizerId: organizer.id,
          email: organizer.email,
          action: "DEACTIVATED",
          deactivatedAt,
          deletedAt: null,
        };
      }

      const [
        events,
        orders,
        financialOrders,
        tickets,
        payouts,
        financialPayouts,
        subscriptionPayments,
        supportMessages,
        adminAuditLogs,
        moderationLogs,
      ] = await Promise.all([
        tx.event.count({
          where: { organizerId: organizer.id },
        }),
        tx.order.count({
          where: {
            event: { organizerId: organizer.id },
          },
        }),
        tx.order.count({
          where: {
            event: { organizerId: organizer.id },
            status: {
              in: [
                OrderStatus.PAID,
                OrderStatus.PARTIALLY_REFUNDED,
                OrderStatus.REFUNDED,
              ],
            },
          },
        }),
        tx.ticket.count({
          where: {
            event: { organizerId: organizer.id },
          },
        }),
        tx.payout.count({
          where: { organizerId: organizer.id },
        }),
        tx.payout.count({
          where: {
            organizerId: organizer.id,
            status: {
              in: [
                PayoutStatus.PENDING,
                PayoutStatus.PROCESSING,
                PayoutStatus.PAID,
              ],
            },
          },
        }),
        tx.subscriptionPayment.count({
          where: { organizerId: organizer.id },
        }),
        tx.supportMessage.count({
          where: { authorId: organizer.id },
        }),
        tx.adminAuditLog.count({
          where: { adminId: organizer.id },
        }),
        tx.eventModerationLog.count({
          where: { adminId: organizer.id },
        }),
      ]);

      const blockers = {
        events,
        orders,
        financialOrders,
        tickets,
        payouts,
        financialPayouts,
        subscriptionPayments,
        supportMessages,
        adminAuditLogs,
        moderationLogs,
      };

      if (
        Object.values(blockers).some(
          (count) => count > 0,
        )
      ) {
        throw new DeleteOrganizerError(
          "Permanent deletion is blocked because this organizer has business, financial, support, or audit data. Deactivate the account instead.",
          "PERMANENT_DELETE_BLOCKED",
          409,
          blockers,
        );
      }

      /*
       * Relations using Cascade/SetNull are handled by PostgreSQL.
       * Restrict relations are checked above so historical/audit data
       * cannot be destroyed accidentally.
       */
      await tx.user.delete({
        where: { id: organizer.id },
      });

      return {
        organizerId: organizer.id,
        email: organizer.email,
        action: "DELETED",
        deactivatedAt: null,
        deletedAt: new Date(),
      };
    },
    {
      isolationLevel:
        Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10_000,
      timeout: 30_000,
    },
  );
}
