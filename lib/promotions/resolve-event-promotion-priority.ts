import {
  EventBoostSource,
  EventBoostStatus,
} from "@prisma/client";

import {
  isPromotionActive,
} from "@/lib/promotions/is-promotion-active";

export type PromotionPriorityInput =
  Readonly<{
    id?:
      string;

    status:
      EventBoostStatus;

    source:
      EventBoostSource;

    priorityScore:
      number;

    startsAt:
      Date | string;

    endsAt:
      Date | string;

    activatedAt?:
      Date | string | null;

    pausedAt?:
      Date | string | null;

    canceledAt?:
      Date | string | null;
  }>;

export type ResolvedPromotionPriority =
  Readonly<{
    isPromoted:
      boolean;

    priorityScore:
      number;

    sourceWeight:
      number;

    effectiveScore:
      number;
  }>;

function clampPriorityScore(
  value:
    number,
): number {
  if (
    !Number.isFinite(
      value,
    )
  ) {
    return 0;
  }

  return Math.min(
    10_000,
    Math.max(
      0,
      Math.trunc(
        value,
      ),
    ),
  );
}

function resolveSourceWeight(
  source:
    EventBoostSource,
): number {
  switch (
    source
  ) {
    case EventBoostSource.ADMIN:
      return 2_000;

    case EventBoostSource.SUBSCRIPTION:
      return 1_000;

    default:
      return 0;
  }
}

export function resolveEventPromotionPriority(
  promotions:
    readonly PromotionPriorityInput[],
  now:
    Date = new Date(),
): ResolvedPromotionPriority {
  let highestScore =
    0;

  let highestSourceWeight =
    0;

  for (
    const promotion of
    promotions
  ) {
    if (
      !isPromotionActive(
        promotion,
        now,
      )
    ) {
      continue;
    }

    const priorityScore =
      clampPriorityScore(
        promotion.priorityScore,
      );

    const sourceWeight =
      resolveSourceWeight(
        promotion.source,
      );

    const effectiveScore =
      sourceWeight +
      priorityScore;

    if (
      effectiveScore >
      highestScore +
        highestSourceWeight
    ) {
      highestScore =
        priorityScore;

      highestSourceWeight =
        sourceWeight;
    }
  }

  return {
    isPromoted:
      highestScore > 0 ||
      highestSourceWeight > 0,

    priorityScore:
      highestScore,

    sourceWeight:
      highestSourceWeight,

    effectiveScore:
      highestScore +
      highestSourceWeight,
  };
}
