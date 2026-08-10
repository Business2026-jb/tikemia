import "server-only";

import {
  MarketingCampaignStatus,
  Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type ExpireEndedMarketingCampaignsInput =
  Readonly<{
    now?: Date;
    batchSize?: number;
  }>;

export type ExpireEndedMarketingCampaignsResult =
  Readonly<{
    processedAt: Date;
    matched: number;
    completed: number;
    campaignIds: readonly string[];
  }>;

function normalizeBatchSize(
  value: number | undefined,
): number {
  if (!Number.isInteger(value)) {
    return 250;
  }

  return Math.min(
    Math.max(Number(value), 1),
    1000,
  );
}

export async function expireEndedMarketingCampaigns(
  input: ExpireEndedMarketingCampaignsInput = {},
): Promise<ExpireEndedMarketingCampaignsResult> {
  const now = input.now ?? new Date();
  const batchSize = normalizeBatchSize(
    input.batchSize,
  );

  const campaigns =
    await prisma.marketingCampaign.findMany({
      where: {
        status: {
          in: [
            MarketingCampaignStatus.SCHEDULED,
            MarketingCampaignStatus.ACTIVE,
            MarketingCampaignStatus.PAUSED,
          ],
        },
        endsAt: {
          not: null,
          lte: now,
        },
      },
      orderBy: {
        endsAt: "asc",
      },
      take: batchSize,
      select: {
        id: true,
      },
    });

  const campaignIds = campaigns.map(
    (campaign) => campaign.id,
  );

  if (campaignIds.length === 0) {
    return {
      processedAt: now,
      matched: 0,
      completed: 0,
      campaignIds: [],
    };
  }

  const result = await prisma.$transaction(
    async (tx) =>
      tx.marketingCampaign.updateMany({
        where: {
          id: {
            in: campaignIds,
          },
          status: {
            in: [
              MarketingCampaignStatus.SCHEDULED,
              MarketingCampaignStatus.ACTIVE,
              MarketingCampaignStatus.PAUSED,
            ],
          },
          endsAt: {
            not: null,
            lte: now,
          },
        },
        data: {
          status:
            MarketingCampaignStatus.COMPLETED,
          isActive: false,
        },
      }),
    {
      isolationLevel:
        Prisma.TransactionIsolationLevel.ReadCommitted,
      maxWait: 5000,
      timeout: 15000,
    },
  );

  return {
    processedAt: now,
    matched: campaignIds.length,
    completed: result.count,
    campaignIds,
  };
}
