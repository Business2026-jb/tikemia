import "server-only";

import {
  EventStatus,
  Prisma,
  TicketScanResult,
  TicketStatus,
} from "@prisma/client";

import {
  prisma,
} from "@/lib/prisma";
import type {
  ScannerAccessRole,
} from "@/lib/scanner/get-scanner-session";

export type ScannerEventSummary =
  Readonly<{
    assignmentId: string | null;
    gateName: string | null;
    assignedAt: Date | null;

    accessSource:
      | "ORGANIZER_OWNER"
      | "ASSIGNMENT";

    event: Readonly<{
      id: string;
      slug: string;
      title: string;
      coverImage: string | null;
      venueName: string;
      city: string;
      country: string;
      startsAt: Date;
      endsAt: Date | null;
      timezone: string;
      status: EventStatus;
      organizerName: string;
    }>;

    statistics: Readonly<{
      totalTickets: number;
      validTickets: number;
      usedTickets: number;
      refusedScans: number;
      acceptedScans: number;
      remainingTickets: number;
      entryRate: number;
      lastScanAt: Date | null;
    }>;
  }>;

type ScannerEventAssignmentRow =
  Readonly<{
    assignmentId: string;
    gateName: string | null;
    assignedAt: Date;
    eventId: string;
    eventSlug: string;
    eventTitle: string;
    eventCoverImage: string | null;
    eventVenueName: string;
    eventCity: string;
    eventCountry: string;
    eventStartsAt: Date;
    eventEndsAt: Date | null;
    eventTimezone: string;
    eventStatus: EventStatus;
    organizerFirstName: string;
    organizerLastName: string;
    organizerBusinessName: string | null;
  }>;

type ScannerEventsInput = {
  userId?: string;
  scannerId?: string;
  userRole?: ScannerAccessRole;
};

type ScannerEventBase =
  Omit<
    ScannerEventSummary,
    "statistics"
  >;

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string {
  return value?.trim() ?? "";
}

function isScannerAccessRole(
  value:
    | string
    | null
    | undefined,
): value is ScannerAccessRole {
  return (
    value ===
      "ORGANIZER" ||
    value ===
      "SCANNER"
  );
}

function buildOrganizerName({
  businessName,
  firstName,
  lastName,
}: {
  businessName:
    | string
    | null;
  firstName: string;
  lastName: string;
}): string {
  const normalizedBusinessName =
    normalizeText(
      businessName,
    );

  if (
    normalizedBusinessName
  ) {
    return normalizedBusinessName;
  }

  return (
    `${normalizeText(
      firstName,
    )} ${normalizeText(
      lastName,
    )}`
      .replace(
        /\s+/g,
        " ",
      )
      .trim() ||
    "Organisateur Tikemia"
  );
}

async function resolveIdentity({
  userId,
  scannerId,
  userRole,
}: ScannerEventsInput): Promise<{
  userId: string;
  userRole: ScannerAccessRole;
} | null> {
  const normalizedUserId =
    normalizeText(
      userId ||
      scannerId,
    );

  if (!normalizedUserId) {
    return null;
  }

  if (
    isScannerAccessRole(
      userRole,
    )
  ) {
    return {
      userId:
        normalizedUserId,

      userRole,
    };
  }

  const user =
    await prisma.user.findUnique({
      where: {
        id:
          normalizedUserId,
      },

      select: {
        role:
          true,

        emailVerified:
          true,

        isActive:
          true,
      },
    });

  if (
    !user ||
    !user.emailVerified ||
    !user.isActive ||
    !isScannerAccessRole(
      user.role,
    )
  ) {
    return null;
  }

  return {
    userId:
      normalizedUserId,

    userRole:
      user.role,
  };
}

async function getOrganizerEvents(
  organizerId: string,
): Promise<
  ScannerEventBase[]
> {
  const events =
    await prisma.event.findMany({
      where: {
        organizerId,

        status: {
          in: [
            EventStatus.PUBLISHED,
            EventStatus.COMPLETED,
          ],
        },
      },

      orderBy: [
        {
          startsAt:
            "asc",
        },

        {
          createdAt:
            "desc",
        },
      ],

      select: {
        id:
          true,

        slug:
          true,

        title:
          true,

        coverImage:
          true,

        venueName:
          true,

        city:
          true,

        country:
          true,

        startsAt:
          true,

        endsAt:
          true,

        timezone:
          true,

        status:
          true,

        organizer: {
          select: {
            firstName:
              true,

            lastName:
              true,

            organizerProfile: {
              select: {
                businessName:
                  true,
              },
            },
          },
        },
      },
    });

  return events.map(
    (
      event,
    ): ScannerEventBase => ({
      assignmentId:
        null,

      gateName:
        "Organisateur",

      assignedAt:
        null,

      accessSource:
        "ORGANIZER_OWNER",

      event: {
        id:
          event.id,

        slug:
          event.slug,

        title:
          event.title,

        coverImage:
          event.coverImage,

        venueName:
          event.venueName,

        city:
          event.city,

        country:
          event.country,

        startsAt:
          event.startsAt,

        endsAt:
          event.endsAt,

        timezone:
          event.timezone,

        status:
          event.status,

        organizerName:
          buildOrganizerName({
            businessName:
              event.organizer
                .organizerProfile
                ?.businessName ??
              null,

            firstName:
              event.organizer.firstName,

            lastName:
              event.organizer.lastName,
          }),
      },
    }),
  );
}

async function getAssignedScannerEvents(
  scannerId: string,
): Promise<
  ScannerEventBase[]
> {
  const rows =
    await prisma.$queryRaw<
      ScannerEventAssignmentRow[]
    >(
      Prisma.sql`
        SELECT
          assignment."id"
            AS "assignmentId",

          assignment."gateName"
            AS "gateName",

          assignment."assignedAt"
            AS "assignedAt",

          event."id"
            AS "eventId",

          event."slug"
            AS "eventSlug",

          event."title"
            AS "eventTitle",

          event."coverImage"
            AS "eventCoverImage",

          event."venueName"
            AS "eventVenueName",

          event."city"
            AS "eventCity",

          event."country"
            AS "eventCountry",

          event."startsAt"
            AS "eventStartsAt",

          event."endsAt"
            AS "eventEndsAt",

          event."timezone"
            AS "eventTimezone",

          event."status"
            AS "eventStatus",

          organizer."firstName"
            AS "organizerFirstName",

          organizer."lastName"
            AS "organizerLastName",

          profile."businessName"
            AS "organizerBusinessName"

        FROM "EventScanner"
          AS assignment

        INNER JOIN "Event"
          AS event
          ON event."id" =
            assignment."eventId"

        INNER JOIN "User"
          AS organizer
          ON organizer."id" =
            event."organizerId"

        LEFT JOIN "OrganizerProfile"
          AS profile
          ON profile."userId" =
            organizer."id"

        WHERE
          assignment."scannerId" =
            ${scannerId}

          AND assignment."isActive" =
            TRUE

          AND assignment."revokedAt"
            IS NULL

          AND event."status" IN (
            'PUBLISHED',
            'COMPLETED'
          )

        ORDER BY
          event."startsAt" ASC,
          assignment."assignedAt" DESC
      `,
    );

  return rows.map(
    (
      row,
    ): ScannerEventBase => ({
      assignmentId:
        row.assignmentId,

      gateName:
        row.gateName,

      assignedAt:
        row.assignedAt,

      accessSource:
        "ASSIGNMENT",

      event: {
        id:
          row.eventId,

        slug:
          row.eventSlug,

        title:
          row.eventTitle,

        coverImage:
          row.eventCoverImage,

        venueName:
          row.eventVenueName,

        city:
          row.eventCity,

        country:
          row.eventCountry,

        startsAt:
          row.eventStartsAt,

        endsAt:
          row.eventEndsAt,

        timezone:
          row.eventTimezone,

        status:
          row.eventStatus,

        organizerName:
          buildOrganizerName({
            businessName:
              row.organizerBusinessName,

            firstName:
              row.organizerFirstName,

            lastName:
              row.organizerLastName,
          }),
      },
    }),
  );
}

async function getEventStatistics(
  eventId: string,
): Promise<
  ScannerEventSummary["statistics"]
> {
  const [
    totalTickets,
    validTickets,
    usedTickets,
    acceptedScans,
    refusedScans,
    lastScan,
  ] =
    await Promise.all([
      prisma.ticket.count({
        where: {
          eventId,
        },
      }),

      prisma.ticket.count({
        where: {
          eventId,

          status:
            TicketStatus.VALID,
        },
      }),

      prisma.ticket.count({
        where: {
          eventId,

          status:
            TicketStatus.USED,
        },
      }),

      prisma.ticketScan.count({
        where: {
          ticket: {
            eventId,
          },

          result:
            TicketScanResult.ACCEPTED,
        },
      }),

      prisma.ticketScan.count({
        where: {
          ticket: {
            eventId,
          },

          result: {
            not:
              TicketScanResult.ACCEPTED,
          },
        },
      }),

      prisma.ticketScan.findFirst({
        where: {
          ticket: {
            eventId,
          },
        },

        orderBy: {
          scannedAt:
            "desc",
        },

        select: {
          scannedAt:
            true,
        },
      }),
    ]);

  const entryRate =
    totalTickets > 0
      ? Number(
          (
            (
              usedTickets /
              totalTickets
            ) *
            100
          ).toFixed(
            1,
          ),
        )
      : 0;

  return {
    totalTickets,

    validTickets,

    usedTickets,

    refusedScans,

    acceptedScans,

    remainingTickets:
      Math.max(
        totalTickets -
          usedTickets,
        0,
      ),

    entryRate,

    lastScanAt:
      lastScan?.scannedAt ??
      null,
  };
}

export async function getScannerEvents({
  userId,
  scannerId,
  userRole,
}: ScannerEventsInput): Promise<
  ScannerEventSummary[]
> {
  const identity =
    await resolveIdentity({
      userId,
      scannerId,
      userRole,
    });

  if (!identity) {
    return [];
  }

  const baseEvents =
    identity.userRole ===
    "ORGANIZER"
      ? await getOrganizerEvents(
          identity.userId,
        )
      : await getAssignedScannerEvents(
          identity.userId,
        );

  return Promise.all(
    baseEvents.map(
      async (
        item,
      ): Promise<ScannerEventSummary> => ({
        ...item,

        statistics:
          await getEventStatistics(
            item.event.id,
          ),
      }),
    ),
  );
}
