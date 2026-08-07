import {
  redirect,
} from "next/navigation";

import ScannerPageClient from "@/components/scanner/scanner-page-client";
import {
  getScannerEvents,
} from "@/lib/scanner/get-scanner-events";
import {
  getScannerSession,
} from "@/lib/scanner/get-scanner-session";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

export default async function ScannerHomePage() {
  const session =
    await getScannerSession();

  if (!session) {
    redirect(
      "/scanner/login",
    );
  }

  const events =
    await getScannerEvents({
      userId:
        session.user.id,

      userRole:
        session.user.role,
    });

  const serializedEvents =
    events.map(
      (
        item,
      ) => {
        const startsAt =
          item.event.startsAt.toISOString();

        return {
          /*
           * ScannerPageClient attend toujours une chaîne.
           * Pour un organisateur, aucune affectation EventScanner
           * n’existe : on génère donc un identifiant stable d’interface.
           */
          assignmentId:
            item.assignmentId ??
            `organizer-${item.event.id}`,

          gateName:
            item.gateName ??
            "Organisateur",

          /*
           * L’organisateur ne possède pas de date d’affectation.
           * On utilise la date de début de l’événement uniquement
           * pour conserver la compatibilité du composant client.
           */
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
      }}
      initialEvents={
        serializedEvents
      }
      initialEventId={
        serializedEvents[0]
          ?.event.id ??
        null
      }
    />
  );
}