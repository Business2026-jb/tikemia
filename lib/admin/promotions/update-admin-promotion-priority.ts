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

export async function updateAdminPromotionPriority(input: {
  promotionId: string;
  adminId: string;
  priorityScore: number;
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

  if (
    !Number.isInteger(input.priorityScore) ||
    input.priorityScore < 0 ||
    input.priorityScore > 10000
  ) {
    throw new AdminPromotionError({
      code: "ADMIN_PROMOTION_PRIORITY_INVALID",
      message:
        "Le score de priorité doit être compris entre 0 et 10000.",
      status: 422,
    });
  }

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

    await tx.eventBoost.update({
      where: { id: boost.id },
      data: { priorityScore: input.priorityScore },
    });

    await createPromotionAuditLog({
      database: tx,
      adminId,
      promotionId: boost.id,
      eventId: boost.eventId,
      organizerId: boost.organizerId,
      action: "PROMOTION_PRIORITY_UPDATED",
      previousStatus: boost.status,
      newStatus: boost.status,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: {
        previousPriorityScore: boost.priorityScore,
        priorityScore: input.priorityScore,
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
      status: boost.status,
      previousPriorityScore: boost.priorityScore,
      priorityScore: input.priorityScore,
    };
  });
}
