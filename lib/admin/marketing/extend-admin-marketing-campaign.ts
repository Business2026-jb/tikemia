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

export type ExtendAdminMarketingCampaignInput = Readonly<{
  campaignId: string;
  adminId: string;
  additionalDays: number;
  reactivateIfCompleted?: boolean;
  ipAddress?: string | null;
  userAgent?: string | null;
}>;

export async function extendAdminMarketingCampaign(
  input: ExtendAdminMarketingCampaignInput,
) {
  const campaignId = normalizeRequired(
    input.campaignId,
    "L’identifiant de la campagne",
  );

  const adminId = normalizeRequired(
    input.adminId,
    "L’identifiant administrateur",
  );

  if (
    !Number.isInteger(input.additionalDays) ||
    input.additionalDays < 1 ||
    input.additionalDays > 3650
  ) {
    throw new AdminMarketingError({
      code: "ADMIN_MARKETING_PERIOD_INVALID",
      message:
        "La prolongation doit être comprise entre 1 et 3650 jours.",
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
            startsAt: true,
            endsAt: true,
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

    if (campaign.status === MarketingCampaignStatus.ARCHIVED) {
      throw new AdminMarketingError({
        code: "ADMIN_MARKETING_ACTION_NOT_ALLOWED",
        message: "Une campagne archivée ne peut pas être prolongée.",
        status: 409,
      });
    }

    const now = new Date();
    const baseDate =
      campaign.endsAt && campaign.endsAt > now ? campaign.endsAt : now;

    const proposedEndsAt = new Date(
      baseDate.getTime() +
        input.additionalDays * 24 * 60 * 60 * 1000,
    );

    const eventLimit = campaign.event.endsAt ?? campaign.event.startsAt;
    const endsAt =
      proposedEndsAt > eventLimit ? eventLimit : proposedEndsAt;

    if (endsAt <= baseDate) {
      throw new AdminMarketingError({
        code: "ADMIN_MARKETING_PERIOD_INVALID",
        message:
          "La nouvelle date ne peut pas dépasser la fin de l’événement.",
        status: 409,
      });
    }

    const shouldReactivate =
      Boolean(input.reactivateIfCompleted) &&
      (campaign.status === MarketingCampaignStatus.COMPLETED ||
        campaign.status === MarketingCampaignStatus.PAUSED);

    const newStatus = shouldReactivate
      ? MarketingCampaignStatus.ACTIVE
      : campaign.status;

    await tx.marketingCampaign.update({
      where: { id: campaign.id },
      data: {
        endsAt,
        status: newStatus,
        isActive: shouldReactivate ? true : campaign.isActive,
      },
    });

    await createMarketingAuditLog(tx, {
      adminId,
      campaignId: campaign.id,
      organizerId: campaign.organizerId,
      eventId: campaign.eventId,
      action: "MARKETING_CAMPAIGN_EXTENDED",
      metadata: {
        previousStatus: campaign.status,
        newStatus,
        previousEndsAt: campaign.endsAt?.toISOString() ?? null,
        endsAt: endsAt.toISOString(),
        requestedAdditionalDays: input.additionalDays,
        reactivated: shouldReactivate,
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
      status: newStatus,
      previousEndsAt: campaign.endsAt,
      endsAt,
      additionalDays: Math.ceil(
        (endsAt.getTime() - baseDate.getTime()) /
          (24 * 60 * 60 * 1000),
      ),
      reactivated: shouldReactivate,
    };
  });
}
