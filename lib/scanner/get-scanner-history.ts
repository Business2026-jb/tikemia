import "server-only";

import {
  TicketScanResult,
} from "@prisma/client";

import {
  prisma,
} from "@/lib/prisma";
import {
  assertScannerCanAccessEvent,
} from "@/lib/scanner/scanner-permissions";

export type ScannerHistoryItem =
  Readonly<{
    id: string;
    result: TicketScanResult;
    scannedAt: Date;
    gateName: string | null;
    deviceName: string | null;
    ticket: Readonly<{
      id: string;
      code: string;
      holderName: string;
      holderEmail: string;
      ticketTypeName: string;
      eventId: string;
      eventTitle: string;
    }>;
  }>;

export type ScannerHistoryResult =
  Readonly<{
    items: ScannerHistoryItem[];
    pagination: Readonly<{
      page: number;
      limit: number;
      total: number;
      pages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    }>;
  }>;

function clampInteger(
  value: number,
  minimum: number,
  maximum: number,
): number {
  if (
    !Number.isFinite(
      value,
    )
  ) {
    return minimum;
  }

  return Math.min(
    Math.max(
      Math.trunc(
        value,
      ),
      minimum,
    ),
    maximum,
  );
}

export async function getScannerHistory({
  scannerId,
  eventId,
  result,
  page = 1,
  limit = 30,
}: {
  scannerId: string;
  eventId?: string | null;
  result?: TicketScanResult | null;
  page?: number;
  limit?: number;
}): Promise<ScannerHistoryResult> {
  const normalizedPage =
    clampInteger(
      page,
      1,
      100_000,
    );

  const normalizedLimit =
    clampInteger(
      limit,
      1,
      100,
    );

  if (eventId) {
    await assertScannerCanAccessEvent({
      scannerId,
      eventId,
      allowCompletedEvent:
        true,
    });
  }

  const where = {
    performedById:
      scannerId,

    ...(eventId
      ? {
          ticket: {
            eventId,
          },
        }
      : {}),

    ...(result
      ? {
          result,
        }
      : {}),
  };

  const [
    total,
    scans,
  ] =
    await Promise.all([
      prisma.ticketScan.count({
        where,
      }),

      prisma.ticketScan.findMany({
        where,

        orderBy: {
          scannedAt:
            "desc",
        },

        skip:
          (
            normalizedPage -
            1
          ) *
          normalizedLimit,

        take:
          normalizedLimit,

        select: {
          id:
            true,
          result:
            true,
          scannedAt:
            true,
          gateName:
            true,
          deviceName:
            true,

          ticket: {
            select: {
              id:
                true,
              code:
                true,
              holderName:
                true,
              holderEmail:
                true,

              ticketType: {
                select: {
                  name:
                    true,
                },
              },

              event: {
                select: {
                  id:
                    true,
                  title:
                    true,
                },
              },
            },
          },
        },
      }),
    ]);

  const pages =
    Math.max(
      Math.ceil(
        total /
          normalizedLimit,
      ),
      1,
    );

  return {
    items:
      scans.map(
        (
          scan,
        ) => ({
          id:
            scan.id,
          result:
            scan.result,
          scannedAt:
            scan.scannedAt,
          gateName:
            scan.gateName,
          deviceName:
            scan.deviceName,

          ticket: {
            id:
              scan.ticket.id,
            code:
              scan.ticket.code,
            holderName:
              scan.ticket.holderName,
            holderEmail:
              scan.ticket.holderEmail,
            ticketTypeName:
              scan.ticket.ticketType.name,
            eventId:
              scan.ticket.event.id,
            eventTitle:
              scan.ticket.event.title,
          },
        }),
      ),

    pagination: {
      page:
        normalizedPage,
      limit:
        normalizedLimit,
      total,
      pages,
      hasNextPage:
        normalizedPage <
        pages,
      hasPreviousPage:
        normalizedPage >
        1,
    },
  };
}
