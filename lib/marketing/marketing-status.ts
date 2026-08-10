import type {
  MarketingCampaignStatus,
} from "@prisma/client";

export type MarketingCampaignRuntimeState =
  | "DRAFT"
  | "SCHEDULED"
  | "ACTIVE"
  | "PAUSED"
  | "COMPLETED"
  | "ARCHIVED"
  | "NOT_STARTED"
  | "ENDED"
  | "INACTIVE";

export type MarketingCampaignStatusInput = Readonly<{
  status: MarketingCampaignStatus;
  isActive: boolean;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
}>;

export const MARKETING_CAMPAIGN_STATUS_LABELS: Readonly<
  Record<MarketingCampaignStatus, string>
> = {
  DRAFT: "Brouillon",
  SCHEDULED: "Programmée",
  ACTIVE: "Active",
  PAUSED: "Suspendue",
  COMPLETED: "Terminée",
  ARCHIVED: "Archivée",
};

function toValidDate(
  value: Date | string | null | undefined,
): Date | null {
  if (!value) {
    return null;
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

export function getMarketingCampaignStatusLabel(
  status: MarketingCampaignStatus,
): string {
  return MARKETING_CAMPAIGN_STATUS_LABELS[status];
}

export function resolveMarketingCampaignRuntimeState(
  campaign: MarketingCampaignStatusInput,
  now: Date = new Date(),
): MarketingCampaignRuntimeState {
  if (campaign.status === "ARCHIVED") {
    return "ARCHIVED";
  }

  if (campaign.status === "COMPLETED") {
    return "COMPLETED";
  }

  if (campaign.status === "PAUSED") {
    return "PAUSED";
  }

  if (campaign.status === "DRAFT") {
    return "DRAFT";
  }

  if (!campaign.isActive) {
    return "INACTIVE";
  }

  const startsAt = toValidDate(campaign.startsAt);
  const endsAt = toValidDate(campaign.endsAt);

  if (endsAt && endsAt <= now) {
    return "ENDED";
  }

  if (startsAt && startsAt > now) {
    return "NOT_STARTED";
  }

  if (
    campaign.status === "ACTIVE" ||
    campaign.status === "SCHEDULED"
  ) {
    return "ACTIVE";
  }

  return campaign.status;
}

export function isTerminalMarketingCampaignStatus(
  status: MarketingCampaignStatus,
): boolean {
  return status === "COMPLETED" || status === "ARCHIVED";
}

export function isEditableMarketingCampaignStatus(
  status: MarketingCampaignStatus,
): boolean {
  return status !== "ARCHIVED";
}
