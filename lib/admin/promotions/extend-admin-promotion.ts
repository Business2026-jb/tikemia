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

export async function extendAdminPromotion(input: {
  promotionId: string;
  adminId: string;
  additionalDays: number;
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
    !Number.isInteger(input.additionalDays) ||
    input.additionalDays < 1 ||
    input.additionalDays > 365
  ) {
    throw new AdminPromotionError({
      code: "ADMIN_PROMOTION_PERIOD_INVALID",
      message:
        "La prolongation doit être comprise entre 1 et 365 jours.",
      status: 422,
    });
  }

  return prisma.$transaction(async (tx) => {
    const boost = await tx.eventBoost.findUnique({
      where: { id: promotionId },
      include: {
        event: true,
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

    if (
      boost.status === EventBoostStatus.CANCELLED ||
      boost.status === EventBoostStatus.EXPIRED
    ) {
      throw new AdminPromotionError({
        code: "ADMIN_PROMOTION_ACTION_NOT_ALLOWED",
        message:
          "Une promotion annulée ou expirée ne peut pas être prolongée.",
        status: 409,
      });
    }

    const eventLimit = boost.event.endsAt ?? boost.event.startsAt;
    const proposedEndsAt = new Date(
      boost.endsAt.getTime() +
        input.additionalDays * 24 * 60 * 60 * 1000,
    );
    const endsAt =
      proposedEndsAt > eventLimit ? eventLimit : proposedEndsAt;

    if (endsAt <= boost.endsAt) {
      throw new AdminPromotionError({
        code: "ADMIN_PROMOTION_PERIOD_INVALID",
        message:
          "La promotion ne peut pas dépasser la fin de l’événement.",
        status: 409,
      });
    }

    await tx.eventBoost.update({
      where: { id: boost.id },
      data: { endsAt },
    });

    await createPromotionAuditLog({
      database: tx,
      adminId,
      promotionId: boost.id,
      eventId: boost.eventId,
      organizerId: boost.organizerId,
      action: "PROMOTION_EXTENDED",
      previousStatus: boost.status,
      newStatus: boost.status,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: {
        previousEndsAt: boost.endsAt.toISOString(),
        endsAt: endsAt.toISOString(),
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
      previousEndsAt: boost.endsAt,
      endsAt,
      additionalDays: Math.ceil(
        (endsAt.getTime() - boost.endsAt.getTime()) /
          (24 * 60 * 60 * 1000),
      ),
    };
  });
}
