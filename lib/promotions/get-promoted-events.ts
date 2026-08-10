import "server-only";

import {
  EventBoostStatus,
  EventStatus,
  Prisma,
} from "@prisma/client";

import {
  prisma,
} from "@/lib/prisma";

export type GetPromotedEventsInput =
  Readonly<{
    limit?:
      number;

    country?:
      string | null;

    countryCode?:
      string | null;

    city?:
      string | null;

    categoryId?:
      string | null;

    categorySlug?:
      string | null;

    excludeEventIds?:
      readonly string[];

    startsAfter?:
      Date | string | null;

    now?:
      Date;
  }>;

export type PromotedEventItem =
  Readonly<{
    promotionId:
      string;

    promotionSource:
      string;

    promotionPriorityScore:
      number;

    promotionStartsAt:
      Date;

    promotionEndsAt:
      Date;

    event: {
      id:
        string;

      organizerId:
        string;

      categoryId:
        string | null;

      title:
        string;

      slug:
        string;

      shortDescription:
        string | null;

      description:
        string;

      coverImage:
        string | null;

      venueName:
        string;

      address:
        string;

      city:
        string;

      country:
        string;

      countryCode:
        string;

      timezone:
        string;

      startsAt:
        Date;

      endsAt:
        Date | null;

      currency:
        string;

      isFree:
        boolean;

      isFeatured:
        boolean;

      publishedAt:
        Date | null;

      category:
        {
          id:
            string;

          name:
            string;

          slug:
            string;

          icon:
            string | null;
        } | null;

      organizer:
        {
          id:
            string;

          firstName:
            string;

          lastName:
            string;

          businessName:
            string | null;

          logo:
            string | null;

          avatar:
            string | null;

          hasBlueBadge:
            boolean;
        };

      ticketTypes:
        readonly {
          id:
            string;

          name:
            string;

          price:
            string;

          quantity:
            number;

          isActive:
            boolean;

          saleStartsAt:
            Date | null;

          saleEndsAt:
            Date | null;
        }[];
    };
  }>;

function normalizedText(
  value:
    | string
    | null
    | undefined,
): string | null {
  const normalized =
    value
      ?.replace(
        /\s+/g,
        " ",
      )
      .trim() ??
    "";

  return normalized ||
    null;
}

function normalizedLimit(
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
    return 12;
  }

  return Math.min(
    Number(
      value,
    ),
    50,
  );
}

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

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    throw new Error(
      "La date de début des événements est invalide.",
    );
  }

  return date;
}

export async function getPromotedEvents(
  input:
    GetPromotedEventsInput = {},
): Promise<
  readonly PromotedEventItem[]
> {
  const now =
    input.now ??
    new Date();

  const limit =
    normalizedLimit(
      input.limit,
    );

  const country =
    normalizedText(
      input.country,
    );

  const countryCode =
    normalizedText(
      input.countryCode,
    );

  const city =
    normalizedText(
      input.city,
    );

  const categoryId =
    normalizedText(
      input.categoryId,
    );

  const categorySlug =
    normalizedText(
      input.categorySlug,
    );

  const startsAfter =
    parseOptionalDate(
      input.startsAfter,
    ) ??
    now;

  const excludedIds =
    Array.from(
      new Set(
        (
          input.excludeEventIds ??
          []
        )
          .map(
            (
              id,
            ) =>
              id.trim(),
          )
          .filter(
            Boolean,
          ),
      ),
    );

  const eventWhere:
    Prisma.EventWhereInput =
    {
      status:
        EventStatus.PUBLISHED,

      startsAt: {
        gt:
          startsAfter,
      },

      ...(country
        ? {
            country: {
              equals:
                country,

              mode:
                "insensitive",
            },
          }
        : {}),

      ...(countryCode
        ? {
            countryCode: {
              equals:
                countryCode.toUpperCase(),

              mode:
                "insensitive",
            },
          }
        : {}),

      ...(city
        ? {
            city: {
              equals:
                city,

              mode:
                "insensitive",
            },
          }
        : {}),

      ...(categoryId
        ? {
            categoryId,
          }
        : {}),

      ...(categorySlug
        ? {
            category: {
              is: {
                slug:
                  categorySlug,
              },
            },
          }
        : {}),

      ...(excludedIds.length >
      0
        ? {
            id: {
              notIn:
                excludedIds,
            },
          }
        : {}),
    };

  const rows =
    await prisma.eventBoost.findMany({
      where: {
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

        event: {
          is:
            eventWhere,
        },
      },

      orderBy: [
        {
          priorityScore:
            "desc",
        },
        {
          activatedAt:
            "asc",
        },
        {
          startsAt:
            "asc",
        },
        {
          createdAt:
            "asc",
        },
      ],

      take:
        Math.min(
          limit * 4,
          200,
        ),

      select: {
        id:
          true,

        source:
          true,

        priorityScore:
          true,

        startsAt:
          true,

        endsAt:
          true,

        event: {
          select: {
            id:
              true,

            organizerId:
              true,

            categoryId:
              true,

            title:
              true,

            slug:
              true,

            shortDescription:
              true,

            description:
              true,

            coverImage:
              true,

            venueName:
              true,

            address:
              true,

            city:
              true,

            country:
              true,

            countryCode:
              true,

            timezone:
              true,

            startsAt:
              true,

            endsAt:
              true,

            currency:
              true,

            isFree:
              true,

            isFeatured:
              true,

            publishedAt:
              true,

            category: {
              select: {
                id:
                  true,

                name:
                  true,

                slug:
                  true,

                icon:
                  true,
              },
            },

            organizer: {
              select: {
                id:
                  true,

                firstName:
                  true,

                lastName:
                  true,

                organizerProfile: {
                  select: {
                    businessName:
                      true,

                    logo:
                      true,

                    avatar:
                      true,

                    hasBlueBadge:
                      true,
                  },
                },
              },
            },

            ticketTypes: {
              where: {
                isActive:
                  true,

                OR: [
                  {
                    saleStartsAt:
                      null,
                  },
                  {
                    saleStartsAt: {
                      lte:
                        now,
                    },
                  },
                ],

                AND: [
                  {
                    OR: [
                      {
                        saleEndsAt:
                          null,
                      },
                      {
                        saleEndsAt: {
                          gt:
                            now,
                        },
                      },
                    ],
                  },
                ],
              },

              orderBy: [
                {
                  price:
                    "asc",
                },
                {
                  createdAt:
                    "asc",
                },
              ],

              select: {
                id:
                  true,

                name:
                  true,

                price:
                  true,

                quantity:
                  true,

                isActive:
                  true,

                saleStartsAt:
                  true,

                saleEndsAt:
                  true,
              },
            },
          },
        },
      },
    });

  const result:
    PromotedEventItem[] =
    [];

  const seenEventIds =
    new Set<string>();

  for (
    const row of
    rows
  ) {
    if (
      seenEventIds.has(
        row.event.id,
      )
    ) {
      continue;
    }

    seenEventIds.add(
      row.event.id,
    );

    result.push({
      promotionId:
        row.id,

      promotionSource:
        row.source,

      promotionPriorityScore:
        row.priorityScore,

      promotionStartsAt:
        row.startsAt,

      promotionEndsAt:
        row.endsAt,

      event: {
        ...row.event,

        organizer: {
          id:
            row.event.organizer.id,

          firstName:
            row.event.organizer.firstName,

          lastName:
            row.event.organizer.lastName,

          businessName:
            row.event.organizer
              .organizerProfile
              ?.businessName ??
            null,

          logo:
            row.event.organizer
              .organizerProfile
              ?.logo ??
            null,

          avatar:
            row.event.organizer
              .organizerProfile
              ?.avatar ??
            null,

          hasBlueBadge:
            row.event.organizer
              .organizerProfile
              ?.hasBlueBadge ??
            false,
        },

        ticketTypes:
          row.event.ticketTypes.map(
            (
              ticketType,
            ) => ({
              ...ticketType,

              price:
                ticketType.price.toFixed(
                  2,
                ),
            }),
          ),
      },
    });

    if (
      result.length >=
      limit
    ) {
      break;
    }
  }

  return result;
}
