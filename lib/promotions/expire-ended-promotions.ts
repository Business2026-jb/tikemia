import "server-only";

import {
  EventBoostStatus,
  EventStatus,
  Prisma,
} from "@prisma/client";

import {
  prisma,
} from "@/lib/prisma";

export type SynchronizePromotionsInput =
  Readonly<{
    now?:
      Date;

    batchSize?:
      number;
  }>;

export type SynchronizePromotionsResult =
  Readonly<{
    checkedAt:
      Date;

    activatedPromotions:
      number;

    expiredPromotions:
      number;

    featuredEventsEnabled:
      number;

    featuredEventsDisabled:
      number;
  }>;

function normalizeBatchSize(
  value:
    number | undefined,
): number {
  if (
    !Number.isInteger(
      value,
    ) ||
    Number(
      value,
    ) <= 0
  ) {
    return 200;
  }

  return Math.min(
    Number(
      value,
    ),
    1_000,
  );
}

async function eventHasAnotherActivePromotion(
  tx:
    Prisma.TransactionClient,
  eventId:
    string,
  now:
    Date,
): Promise<boolean> {
  const count =
    await tx.eventBoost.count({
      where: {
        eventId,

        status:
          EventBoostStatus.ACTIVE,

        startsAt: {
          lte:
            now,
        },

        endsAt: {
          gt:
            now,
        },

        pausedAt:
          null,

        canceledAt:
          null,
      },
    });

  return count > 0;
}

export async function expireEndedPromotions(
  input:
    SynchronizePromotionsInput = {},
): Promise<
  SynchronizePromotionsResult
> {
  const now =
    input.now ??
    new Date();

  const batchSize =
    normalizeBatchSize(
      input.batchSize,
    );

  return prisma.$transaction(
    async (
      tx,
    ) => {
      const [
        dueScheduled,
        ended,
      ] =
        await Promise.all([
          tx.eventBoost.findMany({
            where: {
              status:
                EventBoostStatus.SCHEDULED,

              startsAt: {
                lte:
                  now,
              },

              endsAt: {
                gt:
                  now,
              },

              pausedAt:
                null,

              canceledAt:
                null,

              event: {
                is: {
                  status:
                    EventStatus.PUBLISHED,

                  startsAt: {
                    gt:
                      now,
                  },
                },
              },
            },

            take:
              batchSize,

            orderBy: {
              startsAt:
                "asc",
            },

            select: {
              id:
                true,

              eventId:
                true,

              activatedAt:
                true,
            },
          }),

          tx.eventBoost.findMany({
            where: {
              status: {
                in: [
                  EventBoostStatus.ACTIVE,
                  EventBoostStatus.SCHEDULED,
                  EventBoostStatus.PAUSED,
                ],
              },

              endsAt: {
                lte:
                  now,
              },
            },

            take:
              batchSize,

            orderBy: {
              endsAt:
                "asc",
            },

            select: {
              id:
                true,

              eventId:
                true,
            },
          }),
        ]);

      let activatedPromotions =
        0;

      let expiredPromotions =
        0;

      let featuredEventsEnabled =
        0;

      let featuredEventsDisabled =
        0;

      const activatedEventIds =
        new Set<string>();

      for (
        const promotion of
        dueScheduled
      ) {
        const update =
          await tx.eventBoost.updateMany({
            where: {
              id:
                promotion.id,

              status:
                EventBoostStatus.SCHEDULED,

              startsAt: {
                lte:
                  now,
              },

              endsAt: {
                gt:
                  now,
              },
            },

            data: {
              status:
                EventBoostStatus.ACTIVE,

              activatedAt:
                promotion.activatedAt ??
                now,

              pausedAt:
                null,

              canceledAt:
                null,

              cancellationReason:
                null,
            },
          });

        if (
          update.count !==
          1
        ) {
          continue;
        }

        activatedPromotions +=
          1;

        activatedEventIds.add(
          promotion.eventId,
        );
      }

      for (
        const eventId of
        activatedEventIds
      ) {
        const eventUpdate =
          await tx.event.updateMany({
            where: {
              id:
                eventId,

              status:
                EventStatus.PUBLISHED,

              isFeatured:
                false,
            },

            data: {
              isFeatured:
                true,
            },
          });

        featuredEventsEnabled +=
          eventUpdate.count;
      }

      const expiredEventIds =
        new Set<string>();

      for (
        const promotion of
        ended
      ) {
        const update =
          await tx.eventBoost.updateMany({
            where: {
              id:
                promotion.id,

              status: {
                in: [
                  EventBoostStatus.ACTIVE,
                  EventBoostStatus.SCHEDULED,
                  EventBoostStatus.PAUSED,
                ],
              },

              endsAt: {
                lte:
                  now,
              },
            },

            data: {
              status:
                EventBoostStatus.EXPIRED,

              pausedAt:
                null,
            },
          });

        if (
          update.count !==
          1
        ) {
          continue;
        }

        expiredPromotions +=
          1;

        expiredEventIds.add(
          promotion.eventId,
        );
      }

      for (
        const eventId of
        expiredEventIds
      ) {
        const hasAnotherActivePromotion =
          await eventHasAnotherActivePromotion(
            tx,
            eventId,
            now,
          );

        if (
          hasAnotherActivePromotion
        ) {
          continue;
        }

        const eventUpdate =
          await tx.event.updateMany({
            where: {
              id:
                eventId,

              isFeatured:
                true,
            },

            data: {
              isFeatured:
                false,
            },
          });

        featuredEventsDisabled +=
          eventUpdate.count;
      }

      return {
        checkedAt:
          now,

        activatedPromotions,

        expiredPromotions,

        featuredEventsEnabled,

        featuredEventsDisabled,
      };
    },
    {
      isolationLevel:
        Prisma.TransactionIsolationLevel.ReadCommitted,

      maxWait:
        5_000,

      timeout:
        30_000,
    },
  );
}

export const synchronizePromotionStatuses =
  expireEndedPromotions;
