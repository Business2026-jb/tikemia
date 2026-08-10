import "server-only";

import {
  EventBoostSource,
  EventBoostStatus,
  EventStatus,
  Prisma,
  SubscriptionStatus,
} from "@prisma/client";

import {
  assignPromotedEventSchema,
  formatPromotionValidationErrors,
  removePromotedEventSchema,
  updatePromotedEventSchema,
  type AssignPromotedEventInput,
  type RemovePromotedEventInput,
  type UpdatePromotedEventInput,
} from "@/lib/organizer/promotions/promotion-schemas";
import { prisma } from "@/lib/prisma";

/*
 * Sécurité des droits Premium :
 * seul un abonnement réellement ACTIVE peut autoriser une promotion.
 *
 * PENDING, PAST_DUE, PAUSED, CANCELLED et EXPIRED ne donnent aucun
 * droit de création, réactivation ou programmation de promotion.
 */
const ACTIVE_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.ACTIVE,
];

const OCCUPYING_BOOST_STATUSES: EventBoostStatus[] = [
  EventBoostStatus.SCHEDULED,
  EventBoostStatus.ACTIVE,
  EventBoostStatus.PAUSED,
];

const EDITABLE_BOOST_STATUSES: EventBoostStatus[] = [
  EventBoostStatus.SCHEDULED,
  EventBoostStatus.ACTIVE,
  EventBoostStatus.PAUSED,
];

export type UpdatedPromotedEvent = {
  boostId: string;
  organizerId: string;
  eventId: string;
  subscriptionId: string | null;
  source: EventBoostSource;
  status: EventBoostStatus;
  priorityScore: number;
  startsAt: string;
  endsAt: string;
  activatedAt: string | null;
  pausedAt: string | null;
  canceledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;

  event: {
    id: string;
    title: string;
    slug: string;
    status: EventStatus;
    coverImage: string | null;
    startsAt: string;
    endsAt: string | null;
    publishedAt: string | null;
    city: string;
    country: string;
    venueName: string;
  };

  subscription: {
    id: string;
    status: SubscriptionStatus;
    startsAt: string | null;
    endsAt: string | null;
    plan: {
      id: string;
      code: string;
      name: string;
      maxBoostedEvents: number;
      priorityScore: number;
    };
  } | null;
};

export type UpdatePromotedEventResult = {
  message: string;
  boost: UpdatedPromotedEvent;
};

export class UpdatePromotedEventError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fields?: Record<string, string[]>;
  readonly redirectTo?: string;

  constructor({
    code,
    message,
    status = 400,
    fields,
    redirectTo,
  }: {
    code: string;
    message: string;
    status?: number;
    fields?: Record<string, string[]>;
    redirectTo?: string;
  }) {
    super(message);

    this.name = "UpdatePromotedEventError";
    this.code = code;
    this.status = status;
    this.fields = fields;
    this.redirectTo = redirectTo;
  }
}

type BoostWithRelations = Prisma.EventBoostGetPayload<{
  include: {
    event: {
      select: {
        id: true;
        title: true;
        slug: true;
        status: true;
        coverImage: true;
        startsAt: true;
        endsAt: true;
        publishedAt: true;
        city: true;
        country: true;
        venueName: true;
      };
    };
    subscription: {
      select: {
        id: true;
        status: true;
        startsAt: true;
        endsAt: true;
        plan: {
          select: {
            id: true;
            code: true;
            name: true;
            maxBoostedEvents: true;
            priorityScore: true;
          };
        };
      };
    };
  };
}>;

function toIsoString(
  value: Date | null | undefined,
): string | null {
  return value ? value.toISOString() : null;
}

function normalizeBoost(
  boost: BoostWithRelations,
): UpdatedPromotedEvent {
  return {
    boostId: boost.id,
    organizerId: boost.organizerId,
    eventId: boost.eventId,
    subscriptionId: boost.subscriptionId,
    source: boost.source,
    status: boost.status,
    priorityScore: boost.priorityScore,
    startsAt: boost.startsAt.toISOString(),
    endsAt: boost.endsAt.toISOString(),
    activatedAt: toIsoString(boost.activatedAt),
    pausedAt: toIsoString(boost.pausedAt),
    canceledAt: toIsoString(boost.canceledAt),
    cancellationReason: boost.cancellationReason,
    createdAt: boost.createdAt.toISOString(),
    updatedAt: boost.updatedAt.toISOString(),

    event: {
      id: boost.event.id,
      title: boost.event.title,
      slug: boost.event.slug,
      status: boost.event.status,
      coverImage: boost.event.coverImage,
      startsAt: boost.event.startsAt.toISOString(),
      endsAt: toIsoString(boost.event.endsAt),
      publishedAt: toIsoString(boost.event.publishedAt),
      city: boost.event.city,
      country: boost.event.country,
      venueName: boost.event.venueName,
    },

    subscription: boost.subscription
      ? {
          id: boost.subscription.id,
          status: boost.subscription.status,
          startsAt: toIsoString(
            boost.subscription.startsAt,
          ),
          endsAt: toIsoString(
            boost.subscription.endsAt,
          ),
          plan: {
            id: boost.subscription.plan.id,
            code: boost.subscription.plan.code,
            name: boost.subscription.plan.name,
            maxBoostedEvents:
              boost.subscription.plan.maxBoostedEvents,
            priorityScore:
              boost.subscription.plan.priorityScore,
          },
        }
      : null,
  };
}

function calculateDefaultBoostEndDate({
  subscriptionEndsAt,
  eventEndsAt,
  eventStartsAt,
}: {
  subscriptionEndsAt: Date | null;
  eventEndsAt: Date | null;
  eventStartsAt: Date;
}): Date {
  const eventLimit =
    eventEndsAt ??
    new Date(
      eventStartsAt.getTime() +
        24 * 60 * 60 * 1000,
    );

  if (!subscriptionEndsAt) {
    return eventLimit;
  }

  return subscriptionEndsAt.getTime() <
    eventLimit.getTime()
    ? subscriptionEndsAt
    : eventLimit;
}

function ensureFutureDate(
  value: Date,
  field: string,
) {
  if (value.getTime() <= Date.now()) {
    throw new UpdatePromotedEventError({
      code: "INVALID_PROMOTION_DATE",
      status: 400,
      message:
        field === "startsAt"
          ? "La date de début de la promotion doit être dans le futur ou correspondre au moment actuel."
          : "La date de fin de la promotion doit être dans le futur.",
      fields: {
        [field]: [
          "La date indiquée n’est pas valide.",
        ],
      },
    });
  }
}

async function expireOutdatedData(
  tx: Prisma.TransactionClient,
  organizerId: string,
  now: Date,
) {
  const outdatedSubscriptions =
    await tx.organizerSubscription.findMany({
      where: {
        organizerId,
        status:
          SubscriptionStatus.ACTIVE,
        endsAt: {
          lte: now,
        },
      },
      select: {
        id: true,
      },
    });

  const outdatedSubscriptionIds =
    outdatedSubscriptions.map(
      (subscription) =>
        subscription.id,
    );

  if (
    outdatedSubscriptionIds.length > 0
  ) {
    await tx.organizerSubscription.updateMany({
      where: {
        organizerId,
        id: {
          in: outdatedSubscriptionIds,
        },
        status:
          SubscriptionStatus.ACTIVE,
      },
      data: {
        status:
          SubscriptionStatus.EXPIRED,
        autoRenew: false,
      },
    });

    /*
     * Une promotion liée à un abonnement expiré ne doit jamais rester
     * ACTIVE/SCHEDULED/PAUSED, même si son endsAt propre est incorrect.
     */
    await tx.eventBoost.updateMany({
      where: {
        organizerId,
        subscriptionId: {
          in: outdatedSubscriptionIds,
        },
        status: {
          in: OCCUPYING_BOOST_STATUSES,
        },
      },
      data: {
        status:
          EventBoostStatus.EXPIRED,
      },
    });
  }

  /*
   * Garde-fou complémentaire pour les anciennes promotions dont la
   * date de fin est déjà dépassée.
   */
  await tx.eventBoost.updateMany({
    where: {
      organizerId,
      status: {
        in: OCCUPYING_BOOST_STATUSES,
      },
      endsAt: {
        lte: now,
      },
    },
    data: {
      status:
        EventBoostStatus.EXPIRED,
    },
  });
}

async function getOwnedEvent(
  tx: Prisma.TransactionClient,
  organizerId: string,
  eventId: string,
) {
  const event = await tx.event.findFirst({
    where: {
      id: eventId,
      organizerId,
    },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      coverImage: true,
      startsAt: true,
      endsAt: true,
      publishedAt: true,
      city: true,
      country: true,
      venueName: true,
    },
  });

  if (!event) {
    throw new UpdatePromotedEventError({
      code: "EVENT_NOT_FOUND",
      status: 404,
      message:
        "L’événement demandé est introuvable.",
    });
  }

  return event;
}

async function getUsableSubscription(
  tx: Prisma.TransactionClient,
  {
    organizerId,
    subscriptionId,
    now,
  }: {
    organizerId: string;
    subscriptionId?: string;
    now: Date;
  },
) {
  const subscription =
    await tx.organizerSubscription.findFirst({
      where: {
        organizerId,

        ...(subscriptionId
          ? {
              id: subscriptionId,
            }
          : {}),

        /*
         * Un paiement annulé, échoué, expiré ou simplement en attente
         * ne peut jamais satisfaire cette requête : seul ACTIVE passe.
         */
        status:
          SubscriptionStatus.ACTIVE,

        /*
         * La période Premium doit réellement avoir commencé et avoir
         * une date de fin encore valide. Un abonnement ACTIVE sans
         * startsAt/endsAt est traité comme incohérent et refusé.
         */
        startsAt: {
          lte: now,
        },

        endsAt: {
          gt: now,
        },
      },

      orderBy: [
        {
          createdAt: "desc",
        },
        {
          id: "desc",
        },
      ],

      select: {
        id: true,
        organizerId: true,
        status: true,
        startsAt: true,
        endsAt: true,

        plan: {
          select: {
            id: true,
            code: true,
            name: true,
            maxBoostedEvents: true,
            priorityScore: true,
          },
        },
      },
    });

  if (!subscription) {
    throw new UpdatePromotedEventError({
      code:
        "ACTIVE_SUBSCRIPTION_REQUIRED",
      status: 409,
      message:
        "Un abonnement Premium actif et payé est nécessaire pour promouvoir cet événement.",
    });
  }

  return subscription;
}

function assertSubscriptionCanUsePremium({
  subscription,
  now,
}: {
  subscription: {
    status: SubscriptionStatus;
    startsAt: Date | null;
    endsAt: Date | null;
  } | null;
  now: Date;
}) {
  if (
    !subscription ||
    subscription.status !==
      SubscriptionStatus.ACTIVE ||
    subscription.startsAt === null ||
    subscription.startsAt.getTime() >
      now.getTime() ||
    subscription.endsAt === null ||
    subscription.endsAt.getTime() <=
      now.getTime()
  ) {
    throw new UpdatePromotedEventError({
      code: "SUBSCRIPTION_NOT_USABLE",
      status: 409,
      message:
        "L’abonnement associé à cette promotion n’est plus actif ou son paiement n’a pas été confirmé.",
    });
  }
}

async function getOwnedBoost(
  tx: Prisma.TransactionClient,
  {
    organizerId,
    boostId,
    eventId,
  }: {
    organizerId: string;
    boostId?: string;
    eventId?: string;
  },
) {
  const boost = await tx.eventBoost.findFirst({
    where: {
      organizerId,
      ...(boostId
        ? {
            id: boostId,
          }
        : {}),
      ...(eventId
        ? {
            eventId,
          }
        : {}),
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      event: {
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          coverImage: true,
          startsAt: true,
          endsAt: true,
          publishedAt: true,
          city: true,
          country: true,
          venueName: true,
        },
      },
      subscription: {
        select: {
          id: true,
          status: true,
          startsAt: true,
          endsAt: true,
          plan: {
            select: {
              id: true,
              code: true,
              name: true,
              maxBoostedEvents: true,
              priorityScore: true,
            },
          },
        },
      },
    },
  });

  if (!boost) {
    throw new UpdatePromotedEventError({
      code: "PROMOTION_NOT_FOUND",
      status: 404,
      message:
        "La promotion demandée est introuvable.",
    });
  }

  return boost;
}

async function countOccupiedSlots(
  tx: Prisma.TransactionClient,
  {
    organizerId,
    subscriptionId,
    excludedBoostId,
  }: {
    organizerId: string;
    subscriptionId: string;
    excludedBoostId?: string;
  },
): Promise<number> {
  return tx.eventBoost.count({
    where: {
      organizerId,
      subscriptionId,
      status: {
        in: OCCUPYING_BOOST_STATUSES,
      },
      ...(excludedBoostId
        ? {
            id: {
              not: excludedBoostId,
            },
          }
        : {}),
    },
  });
}

function assertEventCanBePromoted({
  event,
  now,
}: {
  event: {
    status: EventStatus;
    startsAt: Date;
    endsAt: Date | null;
  };
  now: Date;
}) {
  if (event.status !== EventStatus.PUBLISHED) {
    throw new UpdatePromotedEventError({
      code: "EVENT_NOT_PUBLISHED",
      status: 409,
      message:
        "Seuls les événements publiés peuvent être promus.",
    });
  }

  const eventEnd =
    event.endsAt ?? event.startsAt;

  if (eventEnd.getTime() <= now.getTime()) {
    throw new UpdatePromotedEventError({
      code: "EVENT_ALREADY_FINISHED",
      status: 409,
      message:
        "Un événement terminé ne peut pas être promu.",
    });
  }
}

export async function assignPromotedEvent({
  organizerId,
  input,
}: {
  organizerId: string;
  input: AssignPromotedEventInput;
}): Promise<UpdatePromotedEventResult> {
  const parsed =
    assignPromotedEventSchema.safeParse(input);

  if (!parsed.success) {
    throw new UpdatePromotedEventError({
      code: "INVALID_PROMOTION_DATA",
      status: 400,
      message:
        "Les informations de promotion sont invalides.",
      fields: formatPromotionValidationErrors(
        parsed.error,
      ),
    });
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        const now = new Date();

        await expireOutdatedData(
          tx,
          organizerId,
          now,
        );

        const event = await getOwnedEvent(
          tx,
          organizerId,
          parsed.data.eventId,
        );

        assertEventCanBePromoted({
          event,
          now,
        });

        const subscription =
          await getUsableSubscription(tx, {
            organizerId,
            subscriptionId:
              parsed.data.subscriptionId,
            now,
          });

        const existingBoost =
          await tx.eventBoost.findFirst({
            where: {
              organizerId,
              eventId: event.id,
              status: {
                in: OCCUPYING_BOOST_STATUSES,
              },
            },
            include: {
              event: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  status: true,
                  coverImage: true,
                  startsAt: true,
                  endsAt: true,
                  publishedAt: true,
                  city: true,
                  country: true,
                  venueName: true,
                },
              },
              subscription: {
                select: {
                  id: true,
                  status: true,
                  startsAt: true,
                  endsAt: true,
                  plan: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                      maxBoostedEvents: true,
                      priorityScore: true,
                    },
                  },
                },
              },
            },
          });

        if (existingBoost) {
          return {
            message:
              "Cet événement possède déjà une promotion active ou programmée.",
            boost: normalizeBoost(existingBoost),
          };
        }

        const occupiedSlots =
          await countOccupiedSlots(tx, {
            organizerId,
            subscriptionId:
              subscription.id,
          });

        if (
          occupiedSlots >=
          subscription.plan.maxBoostedEvents
        ) {
          throw new UpdatePromotedEventError({
            code: "PROMOTION_LIMIT_REACHED",
            status: 409,
            message:
              "Tous les emplacements Premium de votre formule sont déjà utilisés.",
          });
        }

        const startsAt =
          parsed.data.startsAt ?? now;

        const defaultEndsAt =
          calculateDefaultBoostEndDate({
            subscriptionEndsAt:
              subscription.endsAt,
            eventEndsAt: event.endsAt,
            eventStartsAt: event.startsAt,
          });

        const endsAt =
          parsed.data.endsAt ??
          defaultEndsAt;

        if (
          startsAt.getTime() <
          now.getTime() - 60_000
        ) {
          throw new UpdatePromotedEventError({
            code: "INVALID_PROMOTION_START_DATE",
            status: 400,
            message:
              "La date de début de la promotion ne peut pas être dans le passé.",
          });
        }

        ensureFutureDate(
          endsAt,
          "endsAt",
        );

        if (
          endsAt.getTime() <=
          startsAt.getTime()
        ) {
          throw new UpdatePromotedEventError({
            code: "INVALID_PROMOTION_PERIOD",
            status: 400,
            message:
              "La date de fin doit être postérieure à la date de début.",
          });
        }

        if (
          subscription.endsAt &&
          endsAt.getTime() >
            subscription.endsAt.getTime()
        ) {
          throw new UpdatePromotedEventError({
            code: "PROMOTION_EXCEEDS_SUBSCRIPTION",
            status: 409,
            message:
              "La promotion ne peut pas dépasser la date d’expiration de l’abonnement.",
          });
        }

        const eventLimit =
          event.endsAt ?? event.startsAt;

        if (
          endsAt.getTime() >
          eventLimit.getTime()
        ) {
          throw new UpdatePromotedEventError({
            code: "PROMOTION_EXCEEDS_EVENT",
            status: 409,
            message:
              "La promotion ne peut pas dépasser la fin de l’événement.",
          });
        }

        const status =
          startsAt.getTime() >
          now.getTime()
            ? EventBoostStatus.SCHEDULED
            : EventBoostStatus.ACTIVE;

        const createdBoost =
          await tx.eventBoost.create({
            data: {
              organizerId,
              eventId: event.id,
              subscriptionId:
                subscription.id,
              source:
                parsed.data.source ??
                EventBoostSource.SUBSCRIPTION,
              status,
              priorityScore:
                parsed.data.priorityScore ??
                subscription.plan.priorityScore,
              startsAt,
              endsAt,
              activatedAt:
                status ===
                EventBoostStatus.ACTIVE
                  ? now
                  : null,
            },
            include: {
              event: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  status: true,
                  coverImage: true,
                  startsAt: true,
                  endsAt: true,
                  publishedAt: true,
                  city: true,
                  country: true,
                  venueName: true,
                },
              },
              subscription: {
                select: {
                  id: true,
                  status: true,
                  startsAt: true,
                  endsAt: true,
                  plan: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                      maxBoostedEvents: true,
                      priorityScore: true,
                    },
                  },
                },
              },
            },
          });

        return {
          message:
            status ===
            EventBoostStatus.SCHEDULED
              ? "La promotion de l’événement a été programmée."
              : "L’événement est maintenant promu.",
          boost: normalizeBoost(
            createdBoost,
          ),
        };
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 15_000,
      },
    );
  } catch (error) {
    if (
      error instanceof
      UpdatePromotedEventError
    ) {
      throw error;
    }

    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new UpdatePromotedEventError({
        code: "PROMOTION_ALREADY_EXISTS",
        status: 409,
        message:
          "Cet événement possède déjà une promotion active.",
      });
    }

    console.error(
      "[ASSIGN_PROMOTED_EVENT_ERROR]",
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack:
              process.env.NODE_ENV ===
              "development"
                ? error.stack
                : undefined,
          }
        : error,
    );

    throw new UpdatePromotedEventError({
      code: "ASSIGN_PROMOTION_FAILED",
      status: 500,
      message:
        "Impossible de promouvoir cet événement pour le moment.",
    });
  }
}

export async function updatePromotedEvent({
  organizerId,
  input,
}: {
  organizerId: string;
  input: UpdatePromotedEventInput;
}): Promise<UpdatePromotedEventResult> {
  const parsed =
    updatePromotedEventSchema.safeParse(input);

  if (!parsed.success) {
    throw new UpdatePromotedEventError({
      code: "INVALID_PROMOTION_UPDATE",
      status: 400,
      message:
        "Les informations de mise à jour sont invalides.",
      fields: formatPromotionValidationErrors(
        parsed.error,
      ),
    });
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        const now = new Date();

        await expireOutdatedData(
          tx,
          organizerId,
          now,
        );

        const boost = await getOwnedBoost(
          tx,
          {
            organizerId,
            boostId:
              parsed.data.boostId,
            eventId:
              parsed.data.eventId,
          },
        );

        if (
          !EDITABLE_BOOST_STATUSES.includes(
            boost.status,
          ) &&
          parsed.data.status !==
            EventBoostStatus.CANCELLED
        ) {
          throw new UpdatePromotedEventError({
            code: "PROMOTION_NOT_EDITABLE",
            status: 409,
            message:
              "Cette promotion ne peut plus être modifiée.",
          });
        }

        /*
         * Retirer une promotion doit rester possible même si
         * l'abonnement n'est plus actif. En revanche, toute action
         * qui conserve/réactive/programme le Premium exige un
         * abonnement ACTIVE dans sa période payée.
         */
        if (
          parsed.data.status !==
            EventBoostStatus.CANCELLED &&
          parsed.data.status !==
            EventBoostStatus.PAUSED
        ) {
          assertSubscriptionCanUsePremium({
            subscription:
              boost.subscription,
            now,
          });
        }

        const startsAt =
          parsed.data.startsAt === null
            ? boost.startsAt
            : parsed.data.startsAt ??
              boost.startsAt;

        const endsAt =
          parsed.data.endsAt === null
            ? boost.endsAt
            : parsed.data.endsAt ??
              boost.endsAt;

        if (
          endsAt.getTime() <=
          startsAt.getTime()
        ) {
          throw new UpdatePromotedEventError({
            code: "INVALID_PROMOTION_PERIOD",
            status: 400,
            message:
              "La date de fin doit être postérieure à la date de début.",
          });
        }

        const subscriptionEndsAt =
          boost.subscription?.endsAt ??
          null;

        if (
          subscriptionEndsAt &&
          endsAt.getTime() >
            subscriptionEndsAt.getTime()
        ) {
          throw new UpdatePromotedEventError({
            code: "PROMOTION_EXCEEDS_SUBSCRIPTION",
            status: 409,
            message:
              "La promotion ne peut pas dépasser la date d’expiration de l’abonnement.",
          });
        }

        const eventLimit =
          boost.event.endsAt ??
          boost.event.startsAt;

        if (
          endsAt.getTime() >
          eventLimit.getTime()
        ) {
          throw new UpdatePromotedEventError({
            code: "PROMOTION_EXCEEDS_EVENT",
            status: 409,
            message:
              "La promotion ne peut pas dépasser la fin de l’événement.",
          });
        }

        const requestedStatus =
          parsed.data.status ??
          boost.status;

        const updateData: Prisma.EventBoostUpdateInput =
          {
            startsAt,
            endsAt,

            ...(parsed.data.priorityScore !==
            undefined
              ? {
                  priorityScore:
                    parsed.data.priorityScore,
                }
              : {}),
          };

        switch (requestedStatus) {
          case EventBoostStatus.ACTIVE:
            assertSubscriptionCanUsePremium({
              subscription:
                boost.subscription,
              now,
            });

            assertEventCanBePromoted({
              event: boost.event,
              now,
            });

            updateData.status =
              EventBoostStatus.ACTIVE;
            updateData.activatedAt =
              boost.activatedAt ?? now;
            updateData.pausedAt = null;
            updateData.canceledAt = null;
            updateData.cancellationReason =
              null;
            break;

          case EventBoostStatus.SCHEDULED:
            assertSubscriptionCanUsePremium({
              subscription:
                boost.subscription,
              now,
            });

            if (
              startsAt.getTime() <=
              now.getTime()
            ) {
              throw new UpdatePromotedEventError({
                code: "INVALID_SCHEDULED_DATE",
                status: 400,
                message:
                  "Une promotion programmée doit commencer dans le futur.",
              });
            }

            updateData.status =
              EventBoostStatus.SCHEDULED;
            updateData.pausedAt = null;
            updateData.canceledAt = null;
            updateData.cancellationReason =
              null;
            break;

          case EventBoostStatus.PAUSED:
            updateData.status =
              EventBoostStatus.PAUSED;
            updateData.pausedAt = now;
            break;

          case EventBoostStatus.CANCELLED:
            updateData.status =
              EventBoostStatus.CANCELLED;
            updateData.canceledAt = now;
            updateData.cancellationReason =
              parsed.data
                .cancellationReason ??
              "Promotion retirée par l’organisateur.";
            break;

          case EventBoostStatus.EXPIRED:
            throw new UpdatePromotedEventError({
              code: "INVALID_PROMOTION_STATUS",
              status: 400,
              message:
                "Le statut expiré est appliqué automatiquement.",
            });

          default:
            break;
        }

        const updatedBoost =
          await tx.eventBoost.update({
            where: {
              id: boost.id,
            },
            data: updateData,
            include: {
              event: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  status: true,
                  coverImage: true,
                  startsAt: true,
                  endsAt: true,
                  publishedAt: true,
                  city: true,
                  country: true,
                  venueName: true,
                },
              },
              subscription: {
                select: {
                  id: true,
                  status: true,
                  startsAt: true,
                  endsAt: true,
                  plan: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                      maxBoostedEvents: true,
                      priorityScore: true,
                    },
                  },
                },
              },
            },
          });

        const message =
          requestedStatus ===
          EventBoostStatus.PAUSED
            ? "La promotion a été mise en pause."
            : requestedStatus ===
                EventBoostStatus.ACTIVE
              ? "La promotion a été réactivée."
              : requestedStatus ===
                  EventBoostStatus.CANCELLED
                ? "L’événement a été retiré de la Visibilité Premium."
                : requestedStatus ===
                    EventBoostStatus.SCHEDULED
                  ? "La promotion a été programmée."
                  : "La promotion a été mise à jour.";

        return {
          message,
          boost: normalizeBoost(
            updatedBoost,
          ),
        };
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 15_000,
      },
    );
  } catch (error) {
    if (
      error instanceof
      UpdatePromotedEventError
    ) {
      throw error;
    }

    console.error(
      "[UPDATE_PROMOTED_EVENT_ERROR]",
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack:
              process.env.NODE_ENV ===
              "development"
                ? error.stack
                : undefined,
          }
        : error,
    );

    throw new UpdatePromotedEventError({
      code: "UPDATE_PROMOTION_FAILED",
      status: 500,
      message:
        "Impossible de modifier cette promotion pour le moment.",
    });
  }
}

export async function removePromotedEvent({
  organizerId,
  input,
}: {
  organizerId: string;
  input: RemovePromotedEventInput;
}): Promise<UpdatePromotedEventResult> {
  const parsed =
    removePromotedEventSchema.safeParse(input);

  if (!parsed.success) {
    throw new UpdatePromotedEventError({
      code: "INVALID_PROMOTION_REMOVAL",
      status: 400,
      message:
        "Les informations de retrait sont invalides.",
      fields: formatPromotionValidationErrors(
        parsed.error,
      ),
    });
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        const now = new Date();

        await expireOutdatedData(
          tx,
          organizerId,
          now,
        );

        const boost = await getOwnedBoost(
          tx,
          {
            organizerId,
            boostId:
              parsed.data.boostId,
            eventId:
              parsed.data.eventId,
          },
        );

        if (
          boost.status ===
          EventBoostStatus.CANCELLED
        ) {
          return {
            message:
              "Cette promotion a déjà été retirée.",
            boost: normalizeBoost(boost),
          };
        }

        if (
          boost.status ===
          EventBoostStatus.EXPIRED
        ) {
          return {
            message:
              "Cette promotion est déjà expirée.",
            boost: normalizeBoost(boost),
          };
        }

        const removedBoost =
          await tx.eventBoost.update({
            where: {
              id: boost.id,
            },
            data: {
              status:
                EventBoostStatus.CANCELLED,
              canceledAt: now,
              cancellationReason:
                parsed.data.reason ??
                "Promotion retirée par l’organisateur.",
            },
            include: {
              event: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  status: true,
                  coverImage: true,
                  startsAt: true,
                  endsAt: true,
                  publishedAt: true,
                  city: true,
                  country: true,
                  venueName: true,
                },
              },
              subscription: {
                select: {
                  id: true,
                  status: true,
                  startsAt: true,
                  endsAt: true,
                  plan: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                      maxBoostedEvents: true,
                      priorityScore: true,
                    },
                  },
                },
              },
            },
          });

        return {
          message:
            "L’événement a été retiré de la Visibilité Premium sans supprimer l’événement.",
          boost: normalizeBoost(
            removedBoost,
          ),
        };
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 15_000,
      },
    );
  } catch (error) {
    if (
      error instanceof
      UpdatePromotedEventError
    ) {
      throw error;
    }

    console.error(
      "[REMOVE_PROMOTED_EVENT_ERROR]",
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack:
              process.env.NODE_ENV ===
              "development"
                ? error.stack
                : undefined,
          }
        : error,
    );

    throw new UpdatePromotedEventError({
      code: "REMOVE_PROMOTION_FAILED",
      status: 500,
      message:
        "Impossible de retirer cette promotion pour le moment.",
    });
  }
}