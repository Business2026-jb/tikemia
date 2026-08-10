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

export type ApproveAdminMarketingCampaignInput = Readonly<{
  campaignId: string;
  adminId: string;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
  note?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}>;

function parseOptionalDate(
  value: Date | string | null | undefined,
): Date | null {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new AdminMarketingError({
      code: "ADMIN_MARKETING_PERIOD_INVALID",
      message: "Une date de campagne est invalide.",
      status: 422,
    });
  }

  return date;
}

export async function approveAdminMarketingCampaign(
  input: ApproveAdminMarketingCampaignInput,
) {
  const campaignId = normalizeRequired(
    input.campaignId,
    "L’identifiant de la campagne",
  );

  const adminId = normalizeRequired(
    input.adminId,
    "L’identifiant administrateur",
  );

  return prisma.$transaction(
    async (tx) => {
      const campaign = await tx.marketingCampaign.findUnique({
        where: { id: campaignId },
        include: {
          event: {
            select: {
              title: true,
              startsAt: true,
              endsAt: true,
              status: true,
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
        campaign.status === MarketingCampaignStatus.ARCHIVED ||
        campaign.status === MarketingCampaignStatus.COMPLETED
      ) {
        throw new AdminMarketingError({
          code: "ADMIN_MARKETING_ACTION_NOT_ALLOWED",
          message:
            "Une campagne archivée ou terminée ne peut pas être approuvée.",
          status: 409,
        });
      }

      const now = new Date();
      const startsAt =
        parseOptionalDate(input.startsAt) ?? campaign.startsAt ?? now;
      const endsAt =
        parseOptionalDate(input.endsAt) ??
        campaign.endsAt ??
        campaign.event.endsAt ??
        campaign.event.startsAt;

      if (endsAt <= startsAt) {
        throw new AdminMarketingError({
          code: "ADMIN_MARKETING_PERIOD_INVALID",
          message:
            "La date de fin doit être postérieure à la date de début.",
          status: 422,
        });
      }

      const newStatus =
        startsAt > now
          ? MarketingCampaignStatus.SCHEDULED
          : MarketingCampaignStatus.ACTIVE;

      await tx.marketingCampaign.update({
        where: { id: campaign.id },
        data: {
          status: newStatus,
          isActive: true,
          startsAt,
          endsAt,
        },
      });

      await createMarketingAuditLog(tx, {
        adminId,
        campaignId: campaign.id,
        organizerId: campaign.organizerId,
        eventId: campaign.eventId,
        action: "MARKETING_CAMPAIGN_APPROVED",
        reason: normalizeOptional(input.note),
        metadata: {
          previousStatus: campaign.status,
          newStatus,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
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
        startsAt,
        endsAt,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5000,
      timeout: 15000,
    },
  );
}
