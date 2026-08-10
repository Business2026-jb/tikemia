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

export type UpdateAdminMarketingBudgetInput = Readonly<{
  campaignId: string;
  adminId: string;
  budget: string | number | null;
  reason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}>;

function parseBudget(
  value: string | number | null,
): Prisma.Decimal | null {
  if (value === null || value === "") {
    return null;
  }

  try {
    const budget = new Prisma.Decimal(value);

    if (budget.isNegative()) {
      throw new Error();
    }

    return budget;
  } catch {
    throw new AdminMarketingError({
      code: "ADMIN_MARKETING_BUDGET_INVALID",
      message: "Le budget marketing est invalide.",
      status: 422,
    });
  }
}

export async function updateAdminMarketingBudget(
  input: UpdateAdminMarketingBudgetInput,
) {
  const campaignId = normalizeRequired(
    input.campaignId,
    "L’identifiant de la campagne",
  );

  const adminId = normalizeRequired(
    input.adminId,
    "L’identifiant administrateur",
  );

  const budget = parseBudget(input.budget);

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

    if (campaign.status === MarketingCampaignStatus.ARCHIVED) {
      throw new AdminMarketingError({
        code: "ADMIN_MARKETING_ACTION_NOT_ALLOWED",
        message:
          "Le budget d’une campagne archivée ne peut plus être modifié.",
        status: 409,
      });
    }

    const updated = await tx.marketingCampaign.update({
      where: { id: campaign.id },
      data: { budget },
    });

    await createMarketingAuditLog(tx, {
      adminId,
      campaignId: campaign.id,
      organizerId: campaign.organizerId,
      eventId: campaign.eventId,
      action: "MARKETING_BUDGET_UPDATED",
      reason: normalizeOptional(input.reason),
      metadata: {
        previousBudget: campaign.budget?.toFixed(2) ?? null,
        budget: updated.budget?.toFixed(2) ?? null,
        currency: campaign.currency,
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
      previousBudget: campaign.budget?.toFixed(2) ?? null,
      budget: updated.budget?.toFixed(2) ?? null,
      currency: campaign.currency,
    };
  });
}
