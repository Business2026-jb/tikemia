import "server-only";

import {
  EventBoostStatus,
  EventStatus,
  Prisma,
} from "@prisma/client";

import { AdminPromotionError } from "@/lib/admin/promotions/admin-promotion-errors";
import { createPromotionAuditLog } from "@/lib/admin/promotions/create-promotion-audit-log";
import { prisma } from "@/lib/prisma";

function required(value: string, label: string) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (!normalized) {
    throw new AdminPromotionError({
      code:
        label === "Le motif"
          ? "ADMIN_PROMOTION_REASON_REQUIRED"
          : "ADMIN_PROMOTION_ACTION_NOT_ALLOWED",
      message: `${label} est obligatoire.`,
      status: 400,
    });
  }

  return normalized;
}

export async function approveAdminPromotion(input: {
  promotionId: string;
  adminId: string;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
  priorityScore?: number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const promotionId = required(
    input.promotionId,
    "L’identifiant de la promotion",
  );
  const adminId = required(
    input.adminId,
    "L’identifiant administrateur",
  );

  function date(value: Date | string | null | undefined) {
    if (!value) return null;
    const parsed = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      throw new AdminPromotionError({
        code: "ADMIN_PROMOTION_PERIOD_INVALID",
        message: "Une date de promotion est invalide.",
        status: 422,
      });
    }

    return parsed;
  }

  return prisma.$transaction(
    async (tx) => {
      const boost = await tx.eventBoost.findUnique({
        where: { id: promotionId },
        include: {
          event: true,
          organizer: true,
          subscription: {
            include: {
              plan: true,
              payments: {
                where: { status: "SUCCESS" },
                take: 1,
              },
            },
          },
        },
      });

      if (!boost) {
        throw new AdminPromotionError({
          code: "ADMIN_PROMOTION_NOT_FOUND",
          message: "Cette promotion est introuvable.",
          status: 404,
        });
      }

      if (boost.event.status !== EventStatus.PUBLISHED) {
        throw new AdminPromotionError({
          code: "ADMIN_PROMOTION_EVENT_NOT_PUBLISHED",
          message: "Seul un événement publié peut être mis en avant.",
          status: 409,
        });
      }

      if (
        boost.status === EventBoostStatus.CANCELLED ||
        boost.status === EventBoostStatus.EXPIRED
      ) {
        throw new AdminPromotionError({
          code: "ADMIN_PROMOTION_ACTION_NOT_ALLOWED",
          message:
            "Une promotion annulée ou expirée ne peut pas être approuvée.",
          status: 409,
        });
      }

      if (
        boost.subscription &&
        boost.subscription.payments.length === 0
      ) {
        throw new AdminPromotionError({
          code: "ADMIN_PROMOTION_ACTION_NOT_ALLOWED",
          message:
            "Le paiement associé à l’abonnement n’est pas confirmé.",
          status: 409,
        });
      }

      const now = new Date();
      const startsAt = date(input.startsAt) ?? boost.startsAt;
      const endsAt = date(input.endsAt) ?? boost.endsAt;
      const priorityScore =
        input.priorityScore ?? boost.priorityScore;

      if (endsAt <= startsAt || endsAt <= now) {
        throw new AdminPromotionError({
          code: "ADMIN_PROMOTION_PERIOD_INVALID",
          message:
            "La date de fin doit être postérieure à la date de début.",
          status: 422,
        });
      }

      if (
        !Number.isInteger(priorityScore) ||
        priorityScore < 0 ||
        priorityScore > 10000
      ) {
        throw new AdminPromotionError({
          code: "ADMIN_PROMOTION_PRIORITY_INVALID",
          message:
            "Le score de priorité doit être compris entre 0 et 10000.",
          status: 422,
        });
      }

      const status =
        startsAt <= now
          ? EventBoostStatus.ACTIVE
          : EventBoostStatus.SCHEDULED;

      const updated = await tx.eventBoost.updateMany({
        where: {
          id: boost.id,
          status: boost.status,
          updatedAt: boost.updatedAt,
        },
        data: {
          status,
          startsAt,
          endsAt,
          priorityScore,
          createdByAdminId:
            boost.createdByAdminId ?? adminId,
          activatedAt:
            status === EventBoostStatus.ACTIVE
              ? boost.activatedAt ?? now
              : null,
          pausedAt: null,
          canceledAt: null,
          cancellationReason: null,
        },
      });

      if (updated.count !== 1) {
        throw new AdminPromotionError({
          code: "ADMIN_PROMOTION_ACTION_NOT_ALLOWED",
          message:
            "Cette promotion vient d’être modifiée par un autre administrateur.",
          status: 409,
        });
      }

      await tx.event.update({
        where: { id: boost.eventId },
        data: {
          isFeatured: status === EventBoostStatus.ACTIVE,
        },
      });

      await createPromotionAuditLog({
        database: tx,
        adminId,
        promotionId: boost.id,
        eventId: boost.eventId,
        organizerId: boost.organizerId,
        action: "PROMOTION_APPROVED",
        previousStatus: boost.status,
        newStatus: status,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        metadata: {
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          priorityScore,
        },
      });

      return {
        promotionId: boost.id,
        eventId: boost.eventId,
        eventTitle: boost.event.title,
        organizerId: boost.organizerId,
        organizerEmail: boost.organizer.email,
        organizerName:
          `${boost.organizer.firstName} ${boost.organizer.lastName}`
            .replace(/\s+/g, " ")
            .trim(),
        previousStatus: boost.status,
        status,
        startsAt,
        endsAt,
        priorityScore,
      };
    },
    {
      isolationLevel:
        Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5000,
      timeout: 15000,
    },
  );
}
