import "server-only";

import { Prisma } from "@prisma/client";

export type CreatePromotionAuditLogInput = Readonly<{
  database: Prisma.TransactionClient;
  adminId: string;
  promotionId: string;
  eventId: string;
  organizerId: string;
  action: string;
  previousStatus?: string | null;
  newStatus?: string | null;
  reason?: string | null;
  metadata?: Prisma.InputJsonObject;
  ipAddress?: string | null;
  userAgent?: string | null;
}>;

export async function createPromotionAuditLog(
  input: CreatePromotionAuditLogInput,
): Promise<void> {
  await input.database.adminAuditLog.create({
    data: {
      adminId: input.adminId,
      action: input.action,
      targetType: "EVENT_BOOST",
      targetId: input.promotionId,
      reason: input.reason?.trim() || null,
      ipAddress: input.ipAddress?.trim() || null,
      userAgent: input.userAgent?.trim() || null,
      metadata: {
        promotionId: input.promotionId,
        eventId: input.eventId,
        organizerId: input.organizerId,
        previousStatus: input.previousStatus ?? null,
        newStatus: input.newStatus ?? null,
        ...(input.metadata ?? {}),
      },
    },
  });
}
