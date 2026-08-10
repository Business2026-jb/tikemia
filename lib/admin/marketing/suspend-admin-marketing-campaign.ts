import "server-only";

import {
  MarketingCampaignStatus,
  Prisma,
} from "@prisma/client";

import { AdminMarketingError } from "@/lib/admin/marketing/admin-marketing-errors";
import { createMarketingAuditLog } from "@/lib/admin/marketing/create-marketing-audit-log";
import { prisma } from "@/lib/prisma";

function normalizeRequired(value: string, label: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (!normalized) {
    throw new AdminMarketingError({
      code:
        label === "Le motif"
          ? "ADMIN_MARKETING_REASON_REQUIRED"
          : "ADMIN_MARKETING_ACTION_INVALID",
      message: `${label} est obligatoire.`,
      status: 400,
    });
  }

  return normalized;
}

function normalizeOptional(
  value: string | null | undefined,
): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim() ?? "";
  return normalized || null;
}

export type SuspendAdminMarketingCampaignInput = Readonly<{
  campaignId: string;
  adminId: string;
  reason: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}>;

export async function suspendAdminMarketingCampaign(
  input: SuspendAdminMarketingCampaignInput,
) {
  const campaignId = normalizeRequired(
    input.campaignId,
    "L’identifiant de la campagne",
  );

  const adminId = normalizeRequired(
    input.adminId,
    "L’identifiant administrateur",
  );

  const reason = normalizeRequired(input.reason, "Le motif");

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

    if (
      campaign.status !== MarketingCampaignStatus.ACTIVE &&
      campaign.status !== MarketingCampaignStatus.SCHEDULED
    ) {
      throw new AdminMarketingError({
        code: "ADMIN_MARKETING_ACTION_NOT_ALLOWED",
        message:
          "Seule une campagne active ou programmée peut être suspendue.",
        status: 409,
      });
    }

    await tx.marketingCampaign.update({
      where: { id: campaign.id },
      data: {
        status: MarketingCampaignStatus.PAUSED,
        isActive: false,
      },
    });

    await createMarketingAuditLog(tx, {
      adminId,
      campaignId: campaign.id,
      organizerId: campaign.organizerId,
      eventId: campaign.eventId,
      action: "MARKETING_CAMPAIGN_SUSPENDED",
      reason,
      metadata: {
        previousStatus: campaign.status,
        newStatus: MarketingCampaignStatus.PAUSED,
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
      previousStatus: campaign.status,
      status: MarketingCampaignStatus.PAUSED,
      reason,
    };
  });
}
