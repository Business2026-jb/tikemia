import "server-only";

import type { Prisma } from "@prisma/client";

export type MarketingAuditPriority =
  | "LOW"
  | "NORMAL"
  | "HIGH"
  | "URGENT";

export type CreateMarketingAuditLogInput = Readonly<{
  adminId: string;
  campaignId: string;
  organizerId: string;
  eventId: string;
  action: string;
  reason?: string | null;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
}>;

function normalizeOptional(
  value: string | null | undefined,
): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim() ?? "";
  return normalized || null;
}

export async function createMarketingAuditLog(
  tx: Prisma.TransactionClient,
  input: CreateMarketingAuditLogInput,
) {
  return tx.adminAuditLog.create({
    data: {
      adminId: input.adminId,
      action: input.action,
      targetType: "MARKETING_CAMPAIGN",
      targetId: input.campaignId,
      reason: normalizeOptional(input.reason),
      metadata: {
        campaignId: input.campaignId,
        organizerId: input.organizerId,
        eventId: input.eventId,
        payload: input.metadata ?? null,
      } satisfies Prisma.InputJsonValue,
      ipAddress: normalizeOptional(input.ipAddress),
      userAgent: normalizeOptional(input.userAgent),
    },
    select: {
      id: true,
      createdAt: true,
    },
  });
}
