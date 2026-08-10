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

export async function suspendAdminPromotion(input: {
  promotionId: string;
  adminId: string;
  reason: string;
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
  const reason = required(input.reason, "Le motif");

  return prisma.$transaction(async (tx) => {
    const boost = await tx.eventBoost.findUnique({
      where: { id: promotionId },
      include: {
        event: { select: { id: true, title: true } },
        organizer: true,
      },
    });

    if (!boost) {
      throw new AdminPromotionError({
        code: "ADMIN_PROMOTION_NOT_FOUND",
        message: "Cette promotion est introuvable.",
        status: 404,
      });
    }

    const allowedStatuses: EventBoostStatus[] = [EventBoostStatus.ACTIVE, EventBoostStatus.SCHEDULED];

    if (!allowedStatuses.includes(boost.status)) {
      throw new AdminPromotionError({
        code: "ADMIN_PROMOTION_ACTION_NOT_ALLOWED",
        message: "Cette action n’est pas autorisée pour le statut actuel.",
        status: 409,
      });
    }

    const now = new Date();

    await tx.eventBoost.update({
      where: { id: boost.id },
      data: {
        status: EventBoostStatus.PAUSED,
        pausedAt: now,
        cancellationReason: reason,

      },
    });

    await tx.event.update({
      where: { id: boost.eventId },
      data: { isFeatured: false },
    });

    await createPromotionAuditLog({
      database: tx,
      adminId,
      promotionId: boost.id,
      eventId: boost.eventId,
      organizerId: boost.organizerId,
      action: "PROMOTION_SUSPENDED",
      previousStatus: boost.status,
      newStatus: EventBoostStatus.PAUSED,
      reason,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return {
      promotionId: boost.id,
      eventId: boost.eventId,
      eventTitle: boost.event.title,
      organizerId: boost.organizerId,
      organizerEmail: boost.organizer.email,
      organizerName:
        `${boost.organizer.firstName} ${boost.organizer.lastName}`
          .replace(/\\s+/g, " ")
          .trim(),
      previousStatus: boost.status,
      status: EventBoostStatus.PAUSED,
      reason,
      processedAt: now,
    };
  });
}
