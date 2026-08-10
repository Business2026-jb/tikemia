import "server-only";

import type {
  Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type MarketingPriority =
  | "LOW"
  | "NORMAL"
  | "HIGH"
  | "URGENT";

export const MARKETING_PRIORITY_WEIGHTS: Readonly<
  Record<MarketingPriority, number>
> = {
  LOW: 10,
  NORMAL: 20,
  HIGH: 30,
  URGENT: 40,
};

const PRIORITIES: readonly MarketingPriority[] = [
  "LOW",
  "NORMAL",
  "HIGH",
  "URGENT",
];

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

export function parseMarketingPriorityFromMetadata(
  metadata: Prisma.JsonValue | null | undefined,
): MarketingPriority | null {
  if (!isRecord(metadata)) {
    return null;
  }

  const payload = metadata.payload;

  if (!isRecord(payload)) {
    return null;
  }

  const priority = payload.priority;

  if (
    typeof priority === "string" &&
    PRIORITIES.includes(priority as MarketingPriority)
  ) {
    return priority as MarketingPriority;
  }

  return null;
}

export function getMarketingPriorityWeight(
  priority: MarketingPriority,
): number {
  return MARKETING_PRIORITY_WEIGHTS[priority];
}

export async function resolveMarketingPriority(
  campaignId: string,
): Promise<MarketingPriority> {
  const normalizedCampaignId = campaignId.trim();

  if (!normalizedCampaignId) {
    return "NORMAL";
  }

  const log = await prisma.adminAuditLog.findFirst({
    where: {
      targetType: "MARKETING_CAMPAIGN",
      targetId: normalizedCampaignId,
      action: "MARKETING_PRIORITY_UPDATED",
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      metadata: true,
    },
  });

  return (
    parseMarketingPriorityFromMetadata(
      log?.metadata,
    ) ?? "NORMAL"
  );
}

export async function resolveMarketingPriorities(
  campaignIds: readonly string[],
): Promise<ReadonlyMap<string, MarketingPriority>> {
  const normalizedIds = Array.from(
    new Set(
      campaignIds
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  );

  const result = new Map<string, MarketingPriority>();

  for (const id of normalizedIds) {
    result.set(id, "NORMAL");
  }

  if (normalizedIds.length === 0) {
    return result;
  }

  const logs = await prisma.adminAuditLog.findMany({
    where: {
      targetType: "MARKETING_CAMPAIGN",
      targetId: {
        in: normalizedIds,
      },
      action: "MARKETING_PRIORITY_UPDATED",
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      targetId: true,
      metadata: true,
    },
  });

  for (const log of logs) {
    const targetId = log.targetId;

    if (
      !targetId ||
      !result.has(targetId) ||
      result.get(targetId) !== "NORMAL"
    ) {
      continue;
    }

    const priority =
      parseMarketingPriorityFromMetadata(
        log.metadata,
      );

    if (priority) {
      result.set(targetId, priority);
    }
  }

  return result;
}

export function sortByMarketingPriority<
  T extends {
    priority: MarketingPriority;
    createdAt?: Date | string;
  },
>(
  values: readonly T[],
): T[] {
  return [...values].sort((left, right) => {
    const priorityDifference =
      getMarketingPriorityWeight(right.priority) -
      getMarketingPriorityWeight(left.priority);

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    const leftDate = left.createdAt
      ? new Date(left.createdAt).getTime()
      : 0;

    const rightDate = right.createdAt
      ? new Date(right.createdAt).getTime()
      : 0;

    return rightDate - leftDate;
  });
}
