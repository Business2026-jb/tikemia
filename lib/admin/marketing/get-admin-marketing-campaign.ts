import "server-only";

import { Prisma } from "@prisma/client";

import { AdminMarketingError } from "@/lib/admin/marketing/admin-marketing-errors";
import type { MarketingAuditPriority } from "@/lib/admin/marketing/create-marketing-audit-log";
import { prisma } from "@/lib/prisma";

function normalizeCampaignId(campaignId: string): string {
  const normalized = campaignId.trim();

  if (!normalized) {
    throw new AdminMarketingError({
      code: "ADMIN_MARKETING_ID_REQUIRED",
      message: "L’identifiant de la campagne est obligatoire.",
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
      ["LOW", "NORMAL", "HIGH", "URGENT"].includes(payload.priority)
    ) {
      return payload.priority as MarketingAuditPriority;
    }
  }

  return "NORMAL";
}

export async function getAdminMarketingCampaign(campaignId: string) {
  const id = normalizeCampaignId(campaignId);

  try {
    const campaign = await prisma.marketingCampaign.findUnique({
      where: { id },
      select: {
        id: true,
        organizerId: true,
        eventId: true,
        name: true,
        description: true,
        channel: true,
        status: true,
        source: true,
        medium: true,
        content: true,
        trackingCode: true,
        trackingUrl: true,
        budget: true,
        currency: true,
        goalType: true,
        goalValue: true,
        startsAt: true,
        endsAt: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        event: {
          select: {
            id: true,
            title: true,
            slug: true,
            coverImage: true,
            status: true,
            city: true,
            country: true,
            countryCode: true,
            currency: true,
            venueName: true,
            startsAt: true,
            endsAt: true,
          },
        },
        organizer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            country: true,
            countryCode: true,
            emailVerified: true,
            isActive: true,
            organizerProfile: {
              select: {
                businessName: true,
                logo: true,
                avatar: true,
                description: true,
              },
            },
          },
        },
        visits: {
          orderBy: {
            visitedAt: "desc",
          },
          take: 100,
          select: {
            id: true,
            visitType: true,
            source: true,
            medium: true,
            referrer: true,
            landingUrl: true,
            visitedAt: true,
          },
        },
        attributions: {
          orderBy: {
            attributedAt: "desc",
          },
          take: 100,
          select: {
            id: true,
            orderId: true,
            attributionType: true,
            revenue: true,
            ticketsCount: true,
            discountAmount: true,
            currency: true,
            source: true,
            medium: true,
            attributedAt: true,
            order: {
              select: {
                reference: true,
                status: true,
                total: true,
                paidAt: true,
              },
            },
          },
        },
        promoCodes: {
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            code: true,
            discountType: true,
            discountValue: true,
            currentUses: true,
            maximumUses: true,
            status: true,
            isActive: true,
            startsAt: true,
            expiresAt: true,
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

    const auditLogs = await prisma.adminAuditLog.findMany({
      where: {
        targetType: "MARKETING_CAMPAIGN",
        targetId: campaign.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
      select: {
        id: true,
        action: true,
        reason: true,
        metadata: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        admin: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    const priorityLog = auditLogs.find(
      (log) => log.action === "MARKETING_PRIORITY_UPDATED",
    );

    const revenue = campaign.attributions.reduce(
      (total, attribution) => total.plus(attribution.revenue),
      new Prisma.Decimal(0),
    );

    const discountAmount = campaign.attributions.reduce(
      (total, attribution) => total.plus(attribution.discountAmount),
      new Prisma.Decimal(0),
    );

    const tickets = campaign.attributions.reduce(
      (total, attribution) => total + attribution.ticketsCount,
      0,
    );

    return {
      ...campaign,
      budget: campaign.budget?.toFixed(2) ?? null,
      goalValue: campaign.goalValue?.toFixed(2) ?? null,
      priority: readPriority(priorityLog?.metadata ?? null),
      organizer: {
        ...campaign.organizer,
        fullName:
          `${campaign.organizer.firstName} ${campaign.organizer.lastName}`
            .replace(/\s+/g, " ")
            .trim(),
        profile: campaign.organizer.organizerProfile,
      },
      attributions: campaign.attributions.map((attribution) => ({
        ...attribution,
        revenue: attribution.revenue.toFixed(2),
        discountAmount: attribution.discountAmount.toFixed(2),
        order: {
          ...attribution.order,
          total: attribution.order.total.toFixed(2),
        },
      })),
      promoCodes: campaign.promoCodes.map((promoCode) => ({
        ...promoCode,
        discountValue: promoCode.discountValue.toFixed(2),
      })),
      metrics: {
        visits: campaign.visits.length,
        orders: campaign.attributions.length,
        tickets,
        revenue: revenue.toFixed(2),
        discountAmount: discountAmount.toFixed(2),
        conversionRate:
          campaign.visits.length > 0
            ? Number(
                (
                  (campaign.attributions.length /
                    campaign.visits.length) *
                  100
                ).toFixed(2),
              )
            : 0,
      },
      auditLogs,
    };
  } catch (error) {
    if (error instanceof AdminMarketingError) {
      throw error;
    }

    throw new AdminMarketingError({
      code: "ADMIN_MARKETING_QUERY_FAILED",
      message: "Impossible de charger le dossier de la campagne marketing.",
      status: 500,
      cause: error,
    });
  }
}
