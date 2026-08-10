import type {
  EventStatus,
  MarketingCampaignStatus,
} from "@prisma/client";

export type MarketingCampaignActiveCheckInput = Readonly<{
  status: MarketingCampaignStatus;
  isActive: boolean;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
  eventStatus?: EventStatus | null;
  eventStartsAt?: Date | string | null;
  eventEndsAt?: Date | string | null;
}>;

export type MarketingCampaignActiveCheckResult = Readonly<{
  active: boolean;
  reason:
    | "ACTIVE"
    | "CAMPAIGN_DISABLED"
    | "CAMPAIGN_STATUS_INVALID"
    | "CAMPAIGN_NOT_STARTED"
    | "CAMPAIGN_ENDED"
    | "EVENT_NOT_PUBLISHED"
    | "EVENT_ENDED"
    | "INVALID_DATE";
}>;

function parseDate(
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

export function checkMarketingCampaignActive(
  campaign: MarketingCampaignActiveCheckInput,
  now: Date = new Date(),
): MarketingCampaignActiveCheckResult {
  if (!campaign.isActive) {
    return {
      active: false,
      reason: "CAMPAIGN_DISABLED",
    };
  }

  if (
    campaign.status !== "ACTIVE" &&
    campaign.status !== "SCHEDULED"
  ) {
    return {
      active: false,
      reason: "CAMPAIGN_STATUS_INVALID",
    };
  }

  if (
    campaign.eventStatus &&
    campaign.eventStatus !== "PUBLISHED"
  ) {
    return {
      active: false,
      reason: "EVENT_NOT_PUBLISHED",
    };
  }

  const startsAt = parseDate(campaign.startsAt);
  const endsAt = parseDate(campaign.endsAt);
  const eventStartsAt = parseDate(campaign.eventStartsAt);
  const eventEndsAt = parseDate(campaign.eventEndsAt);

  if (
    campaign.startsAt &&
    !startsAt
  ) {
    return {
      active: false,
      reason: "INVALID_DATE",
    };
  }

  if (
    campaign.endsAt &&
    !endsAt
  ) {
    return {
      active: false,
      reason: "INVALID_DATE",
    };
  }

  if (startsAt && startsAt > now) {
    return {
      active: false,
      reason: "CAMPAIGN_NOT_STARTED",
    };
  }

  if (endsAt && endsAt <= now) {
    return {
      active: false,
      reason: "CAMPAIGN_ENDED",
    };
  }

  const effectiveEventEnd =
    eventEndsAt ?? eventStartsAt;

  if (
    effectiveEventEnd &&
    effectiveEventEnd <= now
  ) {
    return {
      active: false,
      reason: "EVENT_ENDED",
    };
  }

  return {
    active: true,
    reason: "ACTIVE",
  };
}

export function isMarketingCampaignActive(
  campaign: MarketingCampaignActiveCheckInput,
  now: Date = new Date(),
): boolean {
  return checkMarketingCampaignActive(
    campaign,
    now,
  ).active;
}
