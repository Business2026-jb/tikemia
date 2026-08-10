import "server-only";

import {
  EventModerationAction,
  EventStatus,
  OrganizerActivityType,
  Prisma,
  UserRole,
} from "@prisma/client";

import {
  AdminEventError,
} from "@/lib/admin/events/admin-event-errors";
import {
  prisma,
} from "@/lib/prisma";

export type ModerateAdminEventInput =
  Readonly<{
    eventId: string;
    adminId: string;
    action: EventModerationAction;
    reason?: string | null;
    notes?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    metadata?: Prisma.InputJsonValue;
  }>;

export type ModerateAdminEventResult =
  Readonly<{
    eventId: string;
    title: string;
    previousStatus: EventStatus;
    newStatus: EventStatus;
    action: EventModerationAction;
    moderatedAt: Date;
  }>;

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

type TransitionDefinition =
  Readonly<{
    from:
      readonly EventStatus[];
    to: EventStatus;
    reasonRequired: boolean;
    activity:
      OrganizerActivityType;
  }>;

const TRANSITIONS:
  Readonly<
    Partial<
      Record<
        EventModerationAction,
        TransitionDefinition
      >
    >
  > = {
    SUBMIT: {
      from: [
        EventStatus.DRAFT,
        EventStatus.REJECTED,
      ],

      to:
        EventStatus.PENDING,

      reasonRequired:
        false,

      activity:
        OrganizerActivityType.EVENT_SUBMITTED,
    },

    APPROVE: {
      from: [
        EventStatus.PENDING,
      ],

      to:
        EventStatus.PUBLISHED,

      reasonRequired:
        false,

      activity:
        OrganizerActivityType.EVENT_PUBLISHED,
    },

    REJECT: {
      from: [
        EventStatus.PENDING,
      ],

      to:
        EventStatus.REJECTED,

      reasonRequired:
        true,

      activity:
        OrganizerActivityType.EVENT_REJECTED,
    },

    SUSPEND: {
      from: [
        EventStatus.PUBLISHED,
      ],

      to:
        EventStatus.SUSPENDED,

      reasonRequired:
        true,

      activity:
        OrganizerActivityType.EVENT_SUSPENDED,
    },

    RESTORE: {
      from: [
        EventStatus.SUSPENDED,
      ],

      to:
        EventStatus.PUBLISHED,

      reasonRequired:
        false,

      activity:
        OrganizerActivityType.EVENT_RESTORED,
    },

    CANCEL: {
      from: [
        EventStatus.DRAFT,
        EventStatus.PENDING,
        EventStatus.PUBLISHED,
        EventStatus.REJECTED,
        EventStatus.SUSPENDED,
      ],

      to:
        EventStatus.CANCELLED,

      reasonRequired:
        true,

      activity:
        OrganizerActivityType.EVENT_CANCELLED,
    },

    ARCHIVE: {
      from: [
        EventStatus.COMPLETED,
        EventStatus.CANCELLED,
        EventStatus.REJECTED,
      ],

      to:
        EventStatus.ARCHIVED,

      reasonRequired:
        false,

      activity:
        OrganizerActivityType.EVENT_ARCHIVED,
    },
  };

function buildEventUpdate({
  action,
  newStatus,
  adminId,
  reason,
  notes,
  now,
}: {
  action: EventModerationAction;
  newStatus: EventStatus;
  adminId: string;
  reason: string | null;
  notes: string | null;
  now: Date;
}): Prisma.EventUpdateInput {
  const data:
    Prisma.EventUpdateInput = {
    status:
      newStatus,

    reviewedBy: {
      connect: {
        id:
          adminId,
      },
    },

    reviewedAt:
      now,

    adminNotes:
      notes,
  };

  switch (action) {
    case EventModerationAction.SUBMIT:
      data.submittedAt =
        now;

      data.rejectionReason =
        null;

      data.rejectedAt =
        null;
      break;

    case EventModerationAction.APPROVE:
      data.publishedAt =
        now;

      data.rejectionReason =
        null;

      data.rejectedAt =
        null;

      data.suspensionReason =
        null;

      data.suspendedAt =
        null;
      break;

    case EventModerationAction.REJECT:
      data.rejectedAt =
        now;

      data.rejectionReason =
        reason;
      break;

    case EventModerationAction.SUSPEND:
      data.suspendedAt =
        now;

      data.suspensionReason =
        reason;
      break;

    case EventModerationAction.RESTORE:
      data.publishedAt =
        now;

      data.suspendedAt =
        null;

      data.suspensionReason =
        null;
      break;

    case EventModerationAction.CANCEL:
      data.cancelledAt =
        now;

      data.cancellationReason =
        reason;
      break;

    case EventModerationAction.ARCHIVE:
      data.archivedAt =
        now;
      break;

    default:
      break;
  }

  return data;
}

export async function moderateAdminEvent(
  input: ModerateAdminEventInput,
): Promise<ModerateAdminEventResult> {
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

  const reason =
    normalizeText(
      input.reason,
    );

  const notes =
    normalizeText(
      input.notes,
    );

  const transition =
    TRANSITIONS[
      input.action
    ];

  if (!transition) {
    throw new AdminEventError({
      code:
        "ADMIN_EVENT_ACTION_INVALID",

      message:
        "Cette action de modération n’est pas prise en charge.",

      status:
        400,

      details: {
        action:
          input.action,
      },
    });
  }

  if (
    transition.reasonRequired &&
    !reason
  ) {
    throw new AdminEventError({
      code:
        "ADMIN_EVENT_REASON_REQUIRED",

      message:
        "Un motif est obligatoire pour cette action.",

      status:
        400,

      details: {
        action:
          input.action,
      },
    });
  }

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

              organizerId:
                true,

              status:
                true,

              currency:
                true,
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
        !transition.from.includes(
          event.status,
        )
      ) {
        throw new AdminEventError({
          code:
            "ADMIN_EVENT_ACTION_NOT_ALLOWED",

          message:
            "Cette action n’est pas autorisée pour le statut actuel de l’événement.",

          status:
            409,

          details: {
            action:
              input.action,

            currentStatus:
              event.status,

            allowedStatuses:
              transition.from,
          },
        });
      }

      const now =
        new Date();

      await transaction.event.update({
        where: {
          id:
            event.id,
        },

        data:
          buildEventUpdate({
            action:
              input.action,

            newStatus:
              transition.to,

            adminId:
              admin.id,

            reason,
            notes,
            now,
          }),
      });

      await transaction.eventModerationLog.create({
        data: {
          eventId:
            event.id,

          adminId:
            admin.id,

          action:
            input.action,

          previousStatus:
            event.status,

          newStatus:
            transition.to,

          reason,
          notes,

          metadata:
            input.metadata,

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
            `EVENT_${input.action}`,

          targetType:
            "EVENT",

          targetId:
            event.id,

          reason:
            reason ??
            notes,

          metadata: {
            previousStatus:
              event.status,

            newStatus:
              transition.to,

            eventTitle:
              event.title,
          },
        },
      });

      await transaction.organizerActivity.create({
        data: {
          organizerId:
            event.organizerId,

          eventId:
            event.id,

          type:
            transition.activity,

          title:
            event.title,

          description:
            reason ??
            notes,

          currency:
            event.currency,

          metadata: {
            previousStatus:
              event.status,

            newStatus:
              transition.to,

            action:
              input.action,
          },
        },
      });

      return {
        eventId:
          event.id,

        title:
          event.title,

        previousStatus:
          event.status,

        newStatus:
          transition.to,

        action:
          input.action,

        moderatedAt:
          now,
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
