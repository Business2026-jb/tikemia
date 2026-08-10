import "server-only";

import { Prisma } from "@prisma/client";

import { AdminMarketingError } from "@/lib/admin/marketing/admin-marketing-errors";
import {
  createMarketingAuditLog,
  type MarketingAuditPriority,
} from "@/lib/admin/marketing/create-marketing-audit-log";
import { prisma } from "@/lib/prisma";

export type UpdateAdminMarketingPriorityInput = Readonly<{
  campaignId: string;
  adminId: string;
  priority: MarketingAuditPriority;
  reason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}>;

const PRIORITIES: readonly MarketingAuditPriority[] = [
  "LOW",
  "NORMAL",
  "HIGH",
  "URGENT",
];

function normalizeRequired(value: string, label: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (!normalized) {
    throw new AdminMarketingError({
      code: "ADMIN_MARKETING_ACTION_INVALID",
      message: `${label} est obligatoire.`,
      status: 400,
    });
  }

  return normalized;
}

function readPriority(
  metadata: Prisma.JsonValue | null,
): MarketingAuditPriority {
  if (
    metadata &&
    typeof metadata === "object" &&
    !Array.isArray(metadata)
  ) {
    const payload = metadata.payload;

    if (
      payload &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      typeof payload.priority === "string" &&
      PRIORITIES.includes(payload.priority as MarketingAuditPriority)
    ) {
      return payload.priority as MarketingAuditPriority;
    }
  }

  return "NORMAL";
}

export async function updateAdminMarketingPriority(
  input: UpdateAdminMarketingPriorityInput,
) {
  const campaignId = normalizeRequired(
    input.campaignId,
    "L’identifiant de la campagne",
  );

  const adminId = normalizeRequired(
    input.adminId,
    "L’identifiant administrateur",
  );

  if (!PRIORITIES.includes(input.priority)) {
    throw new AdminMarketingError({
      code: "ADMIN_MARKETING_PRIORITY_INVALID",
      message: "La priorité marketing est invalide.",
      status: 422,
    });
  }

  return prisma.$transaction(async (tx) => {
    const campaign = await tx.marketingCampaign.findUnique({
      where: { id: campaignId },
      include: {
        event: {
          select: {
            title: true,
          },
        },
        organizer: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!campaign) {
      throw new AdminMarketingError({
        code: "ADMIN_MARKETING_NOT_FOUND",
        message: "Cette campagne marketing est introuvable.",
        status: 404,
      });
    }

    const previousLog = await tx.adminAuditLog.findFirst({
      where: {
        targetType: "MARKETING_CAMPAIGN",
        targetId: campaign.id,
        action: "MARKETING_PRIORITY_UPDATED",
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        metadata: true,
      },
    });

    const previousPriority = readPriority(previousLog?.metadata ?? null);

    await createMarketingAuditLog(tx, {
      adminId,
      campaignId: campaign.id,
      organizerId: campaign.organizerId,
      eventId: campaign.eventId,
      action: "MARKETING_PRIORITY_UPDATED",
      reason: input.reason,
      metadata: {
        previousPriority,
        priority: input.priority,
      },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return {
      campaignId: campaign.id,
      campaignName: campaign.name,
      eventId: campaign.eventId,
      eventTitle: campaign.event.title,
      organizerId: campaign.organizerId,
      organizerEmail: campaign.organizer.email,
      organizerName:
        `${campaign.organizer.firstName} ${campaign.organizer.lastName}`
          .replace(/\s+/g, " ")
          .trim(),
      previousPriority,
      priority: input.priority,
    };
  });
}
