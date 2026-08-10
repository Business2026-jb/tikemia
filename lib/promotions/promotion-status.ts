import {
  EventBoostStatus,
} from "@prisma/client";

export type PromotionPeriodInput =
  Readonly<{
    status:
      EventBoostStatus;

    startsAt:
      Date | string;

    endsAt:
      Date | string;

    pausedAt?:
      Date | string | null;

    canceledAt?:
      Date | string | null;
  }>;

export type PromotionRuntimeStatus =
  | "SCHEDULED"
  | "ACTIVE"
  | "PAUSED"
  | "CANCELLED"
  | "EXPIRED";

function parseRequiredDate(
  value:
    Date | string,
  label:
    string,
): Date {
  const date =
    value instanceof Date
      ? value
      : new Date(
          value,
        );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    throw new Error(
      `${label} est invalide.`,
    );
  }

  return date;
}

export function resolvePromotionRuntimeStatus(
  promotion:
    PromotionPeriodInput,
  now:
    Date = new Date(),
): PromotionRuntimeStatus {
  if (
    promotion.status ===
      EventBoostStatus.CANCELLED ||
    promotion.canceledAt
  ) {
    return "CANCELLED";
  }

  if (
    promotion.status ===
      EventBoostStatus.PAUSED ||
    promotion.pausedAt
  ) {
    return "PAUSED";
  }

  const startsAt =
    parseRequiredDate(
      promotion.startsAt,
      "La date de début",
    );

  const endsAt =
    parseRequiredDate(
      promotion.endsAt,
      "La date de fin",
    );

  if (
    endsAt.getTime() <=
    now.getTime()
  ) {
    return "EXPIRED";
  }

  if (
    startsAt.getTime() >
    now.getTime()
  ) {
    return "SCHEDULED";
  }

  return "ACTIVE";
}

export function isTerminalPromotionStatus(
  status:
    EventBoostStatus,
): boolean {
  return (
    status ===
      EventBoostStatus.CANCELLED ||
    status ===
      EventBoostStatus.EXPIRED
  );
}

export function isMutablePromotionStatus(
  status:
    EventBoostStatus,
): boolean {
  return !isTerminalPromotionStatus(
    status,
  );
}

export function runtimeStatusToDatabaseStatus(
  status:
    PromotionRuntimeStatus,
): EventBoostStatus {
  switch (
    status
  ) {
    case "ACTIVE":
      return EventBoostStatus.ACTIVE;

    case "PAUSED":
      return EventBoostStatus.PAUSED;

    case "CANCELLED":
      return EventBoostStatus.CANCELLED;

    case "EXPIRED":
      return EventBoostStatus.EXPIRED;

    default:
      return EventBoostStatus.SCHEDULED;
  }
}
