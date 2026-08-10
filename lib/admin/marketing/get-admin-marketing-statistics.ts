import "server-only";

import {
  MarketingCampaignStatus,
  Prisma,
} from "@prisma/client";

import { AdminMarketingError } from "@/lib/admin/marketing/admin-marketing-errors";
import {
  buildAdminMarketingWhere,
  type GetAdminMarketingCampaignsInput,
} from "@/lib/admin/marketing/get-admin-marketing-campaigns";
import { prisma } from "@/lib/prisma";

export async function getAdminMarketingStatistics(
  input: GetAdminMarketingCampaignsInput = {},
) {
  const where = buildAdminMarketingWhere(input);

  try {
    const campaigns = await prisma.marketingCampaign.findMany({
      where,
      select: {
        status: true,
        isActive: true,
        budget: true,
        currency: true,
        startsAt: true,
        endsAt: true,
        visits: {
          select: {
            id: true,
          },
        },
        attributions: {
          select: {
            revenue: true,
            ticketsCount: true,
            discountAmount: true,
            currency: true,
          },
        },
      },
    });

    const now = new Date();
    const budgetsByCurrency: Record<string, Prisma.Decimal> = {};
    const revenueByCurrency: Record<string, Prisma.Decimal> = {};
    const discountsByCurrency: Record<string, Prisma.Decimal> = {};

    let totalVisits = 0;
    let totalOrders = 0;
    let totalTickets = 0;

    for (const campaign of campaigns) {
      totalVisits += campaign.visits.length;
      totalOrders += campaign.attributions.length;
      totalTickets += campaign.attributions.reduce(
        (total, attribution) => total + attribution.ticketsCount,
        0,
      );

      if (campaign.budget) {
        budgetsByCurrency[campaign.currency] = (
          budgetsByCurrency[campaign.currency] ?? new Prisma.Decimal(0)
        ).plus(campaign.budget);
      }

      for (const attribution of campaign.attributions) {
        revenueByCurrency[attribution.currency] = (
          revenueByCurrency[attribution.currency] ??
          new Prisma.Decimal(0)
        ).plus(attribution.revenue);

        discountsByCurrency[attribution.currency] = (
          discountsByCurrency[attribution.currency] ??
          new Prisma.Decimal(0)
        ).plus(attribution.discountAmount);
      }
    }

    const serializeMap = (map: Record<string, Prisma.Decimal>) =>
      Object.fromEntries(
        Object.entries(map).map(([currency, amount]) => [
          currency,
          amount.toFixed(2),
        ]),
      );

    return {
      totalCampaigns: campaigns.length,
      draftCampaigns: campaigns.filter(
        (campaign) => campaign.status === MarketingCampaignStatus.DRAFT,
      ).length,
      scheduledCampaigns: campaigns.filter(
        (campaign) =>
          campaign.status === MarketingCampaignStatus.SCHEDULED ||
          (campaign.startsAt !== null && campaign.startsAt > now),
      ).length,
      activeCampaigns: campaigns.filter(
        (campaign) =>
          campaign.status === MarketingCampaignStatus.ACTIVE &&
          campaign.isActive &&
          (!campaign.startsAt || campaign.startsAt <= now) &&
          (!campaign.endsAt || campaign.endsAt > now),
      ).length,
      pausedCampaigns: campaigns.filter(
        (campaign) => campaign.status === MarketingCampaignStatus.PAUSED,
      ).length,
      completedCampaigns: campaigns.filter(
        (campaign) =>
          campaign.status === MarketingCampaignStatus.COMPLETED ||
          (campaign.endsAt !== null && campaign.endsAt <= now),
      ).length,
      archivedCampaigns: campaigns.filter(
        (campaign) => campaign.status === MarketingCampaignStatus.ARCHIVED,
      ).length,
      totalVisits,
      totalOrders,
      totalTickets,
      conversionRate:
        totalVisits > 0
          ? Number(((totalOrders / totalVisits) * 100).toFixed(2))
          : 0,
      budgetsByCurrency: serializeMap(budgetsByCurrency),
      revenueByCurrency: serializeMap(revenueByCurrency),
      discountsByCurrency: serializeMap(discountsByCurrency),
    };
  } catch (error) {
    if (error instanceof AdminMarketingError) {
      throw error;
    }

    throw new AdminMarketingError({
      code: "ADMIN_MARKETING_QUERY_FAILED",
      message: "Impossible de calculer les statistiques marketing.",
      status: 500,
      cause: error,
    });
  }
}
