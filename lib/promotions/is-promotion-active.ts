import {
  EventBoostStatus,
  EventStatus,
} from "@prisma/client";

import {
  resolvePromotionRuntimeStatus,
} from "@/lib/promotions/promotion-status";

export type ActivePromotionInput =
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

    eventStatus?:
      EventStatus | null;

    eventStartsAt?:
      Date | string | null;
  }>;

function parseOptionalDate(
  value:
    | Date
    | string
    | null
    | undefined,
): Date | null {
  if (!value) {
    return null;
  }

  const date =
    value instanceof Date
      ? value
      : new Date(
          value,
        );

  return Number.isNaN(
    date.getTime(),
  )
    ? null
    : date;
}

export function isPromotionActive(
  promotion:
    ActivePromotionInput,
  now:
    Date = new Date(),
): boolean {
  if (
    promotion.eventStatus !==
      undefined &&
    promotion.eventStatus !==
      null &&
    promotion.eventStatus !==
      EventStatus.PUBLISHED
  ) {
    return false;
  }

  if (
    resolvePromotionRuntimeStatus(
      promotion,
      now,
    ) !==
    "ACTIVE"
  ) {
    return false;
  }

  const eventStartsAt =
    parseOptionalDate(
      promotion.eventStartsAt,
    );

  if (
    eventStartsAt &&
    eventStartsAt.getTime() <=
      now.getTime()
  ) {
    return false;
  }

  return true;
}
