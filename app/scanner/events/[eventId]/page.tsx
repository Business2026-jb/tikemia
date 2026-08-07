import {
  notFound,
  redirect,
} from "next/navigation";

import ScannerPageClient from "@/components/scanner/scanner-page-client";
import {
  getScannerEvents,
} from "@/lib/scanner/get-scanner-events";
import {
  getScannerSession,
} from "@/lib/scanner/get-scanner-session";
import {
  assertScannerCanAccessEvent,
} from "@/lib/scanner/scanner-permissions";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

type ScannerEventPageProps = {
  params: Promise<{
    eventId: string;
  }>;
};

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string {
  return value?.trim() ?? "";
}

export default async function ScannerEventPage({
  params,
}: ScannerEventPageProps) {
  const session =
    await getScannerSession();

  if (!session) {
    redirect(
      "/scanner/login",
    );
  }

  const {
    eventId: rawEventId,
  } =
    await params;

  const eventId =
    normalizeText(
      rawEventId,
    );

  if (!eventId) {
    notFound();
  }

  try {
    await assertScannerCanAccessEvent({
      userId:
        session.user.id,

      userRole:
        session.user.role,

      eventId,

      allowCompletedEvent:
        true,
    });
  } catch {
    notFound();
  }

  const events =
    await getScannerEvents({
      userId:
        session.user.id,

      userRole:
        session.user.role,
    });

  const selectedEvent =
    events.find(
      (
        item,
      ) =>
        item.event.id ===
        eventId,
    );

  if (!selectedEvent) {
    notFound();
  }

  const serializedEvents =
    events.map(
      (
        item,
      ) => {
        const startsAt =
          item.event.startsAt.toISOString();

        return {
          assignmentId:
            item.assignmentId ??
            `organizer-${item.event.id}`,

          gateName:
            item.gateName ??
            "Organisateur",

          assignedAt:
            item.assignedAt?.toISOString() ??
            startsAt,

          event: {
            id:
              item.event.id,

            slug:
              item.event.slug,

            title:
              item.event.title,

            coverImage:
              item.event.coverImage,

            venueName:
              item.event.venueName,

            city:
              item.event.city,

            country:
              item.event.country,

            startsAt,

            endsAt:
              item.event.endsAt?.toISOString() ??
              null,

            timezone:
              item.event.timezone,

            status:
              item.event.status,

            organizerName:
              item.event.organizerName,
          },

          statistics: {
            totalTickets:
              item.statistics.totalTickets,

            validTickets:
              item.statistics.validTickets,

            usedTickets:
              item.statistics.usedTickets,

            refusedScans:
              item.statistics.refusedScans,

            acceptedScans:
              item.statistics.acceptedScans,

            remainingTickets:
              item.statistics.remainingTickets,

            entryRate:
              item.statistics.entryRate,

            lastScanAt:
              item.statistics.lastScanAt?.toISOString() ??
              null,
          },
        };
      },
    );

  return (
    <ScannerPageClient
      scanner={{
        id:
          session.user.id,

        firstName:
          session.user.firstName,

        lastName:
          session.user.lastName,

        email:
          session.user.email,

        role:
          session.user.role,

        accessMode:
          session.accessMode,
      }}
      initialEvents={
        serializedEvents
      }
      initialEventId={
        selectedEvent.event.id
      }
    />
  );
}