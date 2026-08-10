import "server-only";

import {
  EventModerationAction,
  EventStatus,
  Prisma,
  UserRole,
} from "@prisma/client";

import {
  AdminEventError,
} from "@/lib/admin/events/admin-event-errors";
import {
  prisma,
} from "@/lib/prisma";

export type DeleteAdminEventInput =
  Readonly<{
    eventId: string;
    adminId: string;
    confirmationTitle: string;
    reason?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
  }>;

export type DeleteAdminEventResult =
  Readonly<{
    eventId: string;
    title: string;
    deletedAt: Date;
  }>;

const DELETABLE_STATUSES:
  readonly EventStatus[] = [
    EventStatus.DRAFT,
    EventStatus.PENDING,
    EventStatus.REJECTED,
  ];

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string | null {
  const normalized =
    value
      ?.replace(
        /\s+/g,
        " ",
      )
      .trim() ??
    "";

  return (
    normalized ||
    null
  );
}

function requireText(
  value: string,
  code:
    | "ADMIN_EVENT_ID_REQUIRED"
    | "ADMIN_EVENT_ADMIN_ID_REQUIRED",
  message: string,
): string {
  const normalized =
    value.trim();

  if (!normalized) {
    throw new AdminEventError({
      code,
      message,
      status:
        400,
    });
  }

  return normalized;
}

export async function deleteAdminEvent(
  input: DeleteAdminEventInput,
): Promise<DeleteAdminEventResult> {
  const eventId =
    requireText(
      input.eventId,
      "ADMIN_EVENT_ID_REQUIRED",
      "L’identifiant de l’événement est obligatoire.",
    );

  const adminId =
    requireText(
      input.adminId,
      "ADMIN_EVENT_ADMIN_ID_REQUIRED",
      "L’identifiant de l’administrateur est obligatoire.",
    );

  const confirmationTitle =
    input.confirmationTitle
      .replace(
        /\s+/g,
        " ",
      )
      .trim();

  const reason =
    normalizeText(
      input.reason,
    );

  return prisma.$transaction(
    async (
      transaction,
    ) => {
      const [
        event,
        admin,
      ] =
        await Promise.all([
          transaction.event.findUnique({
            where: {
              id:
                eventId,
            },

            select: {
              id:
                true,

              title:
                true,

              status:
                true,

              organizerId:
                true,

              _count: {
                select: {
                  orders:
                    true,

                  tickets:
                    true,

                  ticketTypes:
                    true,

                  scannerAssignments:
                    true,

                  platformReports:
                    true,
                },
              },
            },
          }),

          transaction.user.findFirst({
            where: {
              id:
                adminId,

              role:
                UserRole.ADMIN,

              isActive:
                true,
            },

            select: {
              id:
                true,
            },
          }),
        ]);

      if (!event) {
        throw new AdminEventError({
          code:
            "ADMIN_EVENT_NOT_FOUND",

          message:
            "Cet événement est introuvable.",

          status:
            404,
        });
      }

      if (!admin) {
        throw new AdminEventError({
          code:
            "ADMIN_EVENT_ADMIN_ID_REQUIRED",

          message:
            "Le compte administrateur est invalide ou inactif.",

          status:
            403,
        });
      }

      if (
        confirmationTitle !==
        event.title
      ) {
        throw new AdminEventError({
          code:
            "ADMIN_EVENT_DELETE_NOT_ALLOWED",

          message:
            "Le titre de confirmation ne correspond pas à l’événement.",

          status:
            400,
        });
      }

      if (
        !DELETABLE_STATUSES.includes(
          event.status,
        )
      ) {
        throw new AdminEventError({
          code:
            "ADMIN_EVENT_DELETE_NOT_ALLOWED",

          message:
            "Seuls les événements en brouillon, en attente ou rejetés peuvent être supprimés définitivement.",

          status:
            409,

          details: {
            currentStatus:
              event.status,

            deletableStatuses:
              DELETABLE_STATUSES,
          },
        });
      }

      const [
        paymentsCount,
        paidOrdersCount,
        refundsCount,
        deliveriesCount,
      ] =
        await Promise.all([
          transaction.payment.count({
            where: {
              order: {
                eventId:
                  event.id,
              },
            },
          }),

          transaction.order.count({
            where: {
              eventId:
                event.id,

              status: {
                in: [
                  "PAID",
                  "PARTIALLY_REFUNDED",
                  "REFUNDED",
                ],
              },
            },
          }),

          transaction.paymentRefund.count({
            where: {
              order: {
                eventId:
                  event.id,
              },
            },
          }),

          transaction.deliveryLog.count({
            where: {
              order: {
                eventId:
                  event.id,
              },
            },
          }),
        ]);

      const blockers = {
        orders:
          event._count
            .orders,

        paidOrders:
          paidOrdersCount,

        tickets:
          event._count
            .tickets,

        payments:
          paymentsCount,

        refunds:
          refundsCount,

        deliveries:
          deliveriesCount,
      };

      if (
        Object.values(
          blockers,
        ).some(
          (
            value,
          ) =>
            value >
            0,
        )
      ) {
        throw new AdminEventError({
          code:
            "ADMIN_EVENT_DELETE_BLOCKED",

          message:
            "La suppression définitive est impossible car cet événement possède déjà des commandes, paiements, billets ou données de livraison.",

          status:
            409,

          details:
            blockers,
        });
      }

      const deletedAt =
        new Date();

      await transaction.eventModerationLog.create({
        data: {
          eventId:
            event.id,

          adminId:
            admin.id,

          action:
            EventModerationAction.DELETE,

          previousStatus:
            event.status,

          newStatus:
            event.status,

          reason,

          notes:
            "Suppression définitive de l’événement.",

          ipAddress:
            normalizeText(
              input.ipAddress,
            ),

          userAgent:
            normalizeText(
              input.userAgent,
            ),
        },
      });

      await transaction.adminAuditLog.create({
        data: {
          adminId:
            admin.id,

          action:
            "EVENT_DELETE",

          targetType:
            "EVENT",

          targetId:
            event.id,

          reason,

          metadata: {
            title:
              event.title,

            status:
              event.status,

            organizerId:
              event.organizerId,
          },
        },
      });

      /*
       * Les journaux de modération sont supprimés par cascade avec
       * l’événement. Le journal d’audit administratif reste conservé.
       */
      await transaction.event.delete({
        where: {
          id:
            event.id,
        },
      });

      return {
        eventId:
          event.id,

        title:
          event.title,

        deletedAt,
      };
    },
    {
      isolationLevel:
        Prisma.TransactionIsolationLevel
          .Serializable,

      maxWait:
        10_000,

      timeout:
        30_000,
    },
  );
}
