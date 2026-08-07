import "server-only";

import {
  EventStatus,
  Prisma,
} from "@prisma/client";

import {
  prisma,
} from "@/lib/prisma";
import {
  ScannerAuthorizationError,
  ScannerError,
} from "@/lib/scanner/scanner-errors";
import type {
  ScannerAccessRole,
} from "@/lib/scanner/get-scanner-session";

export type ScannerEventPermissionSource =
  | "ORGANIZER_OWNER"
  | "ASSIGNMENT";

export type ScannerEventPermission =
  Readonly<{
    assignmentId: string | null;
    scannerId: string;
    eventId: string;
    gateName: string | null;
    assignedAt: Date | null;
    source: ScannerEventPermissionSource;

    event: Readonly<{
      id: string;
      title: string;
      slug: string;
      status: EventStatus;
      startsAt: Date;
      endsAt: Date | null;
      venueName: string;
      city: string;
      country: string;
      timezone: string;
      organizerId: string;
    }>;
  }>;

type EventScannerPermissionRow =
  Readonly<{
    assignmentId: string;
    scannerId: string;
    eventId: string;
    gateName: string | null;
    assignedAt: Date;
    eventTitle: string;
    eventSlug: string;
    eventStatus: EventStatus;
    eventStartsAt: Date;
    eventEndsAt: Date | null;
    eventVenueName: string;
    eventCity: string;
    eventCountry: string;
    eventTimezone: string;
    eventOrganizerId: string;
  }>;

type ScannerPermissionIdentity = {
  userId?: string;
  scannerId?: string;
  userRole?: ScannerAccessRole;
};

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

async function resolveIdentity({
  userId,
  scannerId,
  userRole,
  transaction,
}: ScannerPermissionIdentity & {
  transaction?:
    | Prisma.TransactionClient
    | null;
}): Promise<{
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

  const database =
    transaction ??
    prisma;

  const user =
    await database.user.findUnique({
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

async function getOrganizerPermission({
  organizerId,
  eventId,
  transaction,
}: {
  organizerId: string;
  eventId: string;
  transaction?:
    | Prisma.TransactionClient
    | null;
}): Promise<ScannerEventPermission | null> {
  const database =
    transaction ??
    prisma;

  const event =
    await database.event.findFirst({
      where: {
        id:
          eventId,

        organizerId,
      },

      select: {
        id:
          true,

        title:
          true,

        slug:
          true,

        status:
          true,

        startsAt:
          true,

        endsAt:
          true,

        venueName:
          true,

        city:
          true,

        country:
          true,

        timezone:
          true,

        organizerId:
          true,
      },
    });

  if (!event) {
    return null;
  }

  return {
    assignmentId:
      null,

    scannerId:
      organizerId,

    eventId:
      event.id,

    gateName:
      "Organisateur",

    assignedAt:
      null,

    source:
      "ORGANIZER_OWNER",

    event,
  };
}

async function getAssignedScannerPermission({
  scannerId,
  eventId,
  transaction,
}: {
  scannerId: string;
  eventId: string;
  transaction?:
    | Prisma.TransactionClient
    | null;
}): Promise<ScannerEventPermission | null> {
  const database =
    transaction ??
    prisma;

  const rows =
    await database.$queryRaw<
      EventScannerPermissionRow[]
    >(
      Prisma.sql`
        SELECT
          assignment."id"
            AS "assignmentId",

          assignment."scannerId"
            AS "scannerId",

          assignment."eventId"
            AS "eventId",

          assignment."gateName"
            AS "gateName",

          assignment."assignedAt"
            AS "assignedAt",

          event."title"
            AS "eventTitle",

          event."slug"
            AS "eventSlug",

          event."status"
            AS "eventStatus",

          event."startsAt"
            AS "eventStartsAt",

          event."endsAt"
            AS "eventEndsAt",

          event."venueName"
            AS "eventVenueName",

          event."city"
            AS "eventCity",

          event."country"
            AS "eventCountry",

          event."timezone"
            AS "eventTimezone",

          event."organizerId"
            AS "eventOrganizerId"

        FROM "EventScanner"
          AS assignment

        INNER JOIN "Event"
          AS event
          ON event."id" =
            assignment."eventId"

        WHERE
          assignment."scannerId" =
            ${scannerId}

          AND assignment."eventId" =
            ${eventId}

          AND assignment."isActive" =
            TRUE

          AND assignment."revokedAt"
            IS NULL

        LIMIT 1
      `,
    );

  const row =
    rows[0];

  if (!row) {
    return null;
  }

  return {
    assignmentId:
      row.assignmentId,

    scannerId:
      row.scannerId,

    eventId:
      row.eventId,

    gateName:
      row.gateName,

    assignedAt:
      row.assignedAt,

    source:
      "ASSIGNMENT",

    event: {
      id:
        row.eventId,

      title:
        row.eventTitle,

      slug:
        row.eventSlug,

      status:
        row.eventStatus,

      startsAt:
        row.eventStartsAt,

      endsAt:
        row.eventEndsAt,

      venueName:
        row.eventVenueName,

      city:
        row.eventCity,

      country:
        row.eventCountry,

      timezone:
        row.eventTimezone,

      organizerId:
        row.eventOrganizerId,
    },
  };
}

export async function getScannerEventPermission({
  userId,
  scannerId,
  userRole,
  eventId,
  transaction,
}: ScannerPermissionIdentity & {
  eventId: string;
  transaction?:
    | Prisma.TransactionClient
    | null;
}): Promise<ScannerEventPermission | null> {
  const normalizedEventId =
    normalizeText(
      eventId,
    );

  if (!normalizedEventId) {
    return null;
  }

  const identity =
    await resolveIdentity({
      userId,
      scannerId,
      userRole,
      transaction,
    });

  if (!identity) {
    return null;
  }

  if (
    identity.userRole ===
    "ORGANIZER"
  ) {
    return getOrganizerPermission({
      organizerId:
        identity.userId,

      eventId:
        normalizedEventId,

      transaction,
    });
  }

  return getAssignedScannerPermission({
    scannerId:
      identity.userId,

    eventId:
      normalizedEventId,

    transaction,
  });
}

export async function assertScannerCanAccessEvent({
  userId,
  scannerId,
  userRole,
  eventId,
  transaction,
  allowCompletedEvent = false,
}: ScannerPermissionIdentity & {
  eventId: string;
  transaction?:
    | Prisma.TransactionClient
    | null;
  allowCompletedEvent?: boolean;
}): Promise<ScannerEventPermission> {
  const identity =
    await resolveIdentity({
      userId,
      scannerId,
      userRole,
      transaction,
    });

  if (!identity) {
    throw new ScannerAuthorizationError(
      "Ce compte n’est pas autorisé à accéder au scanner Tikemia.",
      {
        userId:
          normalizeText(
            userId ||
            scannerId,
          ) ||
          null,

        eventId:
          normalizeText(
            eventId,
          ) ||
          null,
      },
    );
  }

  const permission =
    await getScannerEventPermission({
      userId:
        identity.userId,

      userRole:
        identity.userRole,

      eventId,

      transaction,
    });

  if (!permission) {
    throw new ScannerAuthorizationError(
      identity.userRole ===
      "ORGANIZER"
        ? "Cet événement ne vous appartient pas."
        : "Vous n’êtes pas affecté à cet événement ou votre accès a été désactivé.",
      {
        userId:
          identity.userId,

        userRole:
          identity.userRole,

        eventId,
      },
    );
  }

  const allowedStatuses:
    EventStatus[] = [
      EventStatus.PUBLISHED,
    ];

  if (allowCompletedEvent) {
    allowedStatuses.push(
      EventStatus.COMPLETED,
    );
  }

  if (
    !allowedStatuses.includes(
      permission.event.status,
    )
  ) {
    throw new ScannerError({
      code:
        "SCANNER_EVENT_NOT_SCANNABLE",

      message:
        permission.event.status ===
        EventStatus.COMPLETED
          ? "Cet événement est terminé. Le contrôle d’accès est fermé."
          : "Cet événement n’est pas actuellement ouvert au contrôle d’accès.",

      status:
        409,

      retryable:
        false,

      details: {
        eventId:
          permission.event.id,

        eventTitle:
          permission.event.title,

        eventStatus:
          permission.event.status,
      },
    });
  }

  return permission;
}
