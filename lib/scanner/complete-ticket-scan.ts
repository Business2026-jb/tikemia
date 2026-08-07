import "server-only";

import {
  createHash,
} from "node:crypto";

import {
  Prisma,
  TicketScanResult,
  TicketStatus,
} from "@prisma/client";

import {
  prisma,
} from "@/lib/prisma";
import {
  ScannerError,
} from "@/lib/scanner/scanner-errors";
import {
  verifyTicketForScan,
  type TicketAuthenticity,
  type VerifiedTicketInformation,
} from "@/lib/scanner/verify-ticket-for-scan";

export type CompleteTicketScanInput =
  Readonly<{
    scannerId: string;
    eventId: string;
    qrValue: string;
    deviceId?: string | null;
    deviceName?: string | null;
    gateName?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    metadata?: Prisma.InputJsonValue | null;
  }>;

export type CompleteTicketScanResult =
  Readonly<{
    accepted: boolean;
    result: TicketScanResult;
    message: string;
    scanId: string | null;
    scannedAt: Date;
    ticket: VerifiedTicketInformation | null;
    authenticity: TicketAuthenticity | null;
    firstUse: Readonly<{
      usedAt: Date | null;
      scannedAt: Date | null;
    }> | null;
  }>;

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string | null {
  const normalized =
    value?.trim() ?? "";

  return normalized || null;
}

function hashScannedValue(
  value: string,
): string {
  return createHash(
    "sha256",
  )
    .update(
      value,
      "utf8",
    )
    .digest(
      "hex",
    );
}

function decimalOrNull(
  value:
    | number
    | null
    | undefined,
): Prisma.Decimal | null {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(
      value,
    )
  ) {
    return null;
  }

  return new Prisma.Decimal(
    value,
  );
}

async function createKnownTicketScan({
  transaction,
  ticketId,
  scannerId,
  result,
  scannedCodeHash,
  input,
  scannedAt,
}: {
  transaction: Prisma.TransactionClient;
  ticketId: string;
  scannerId: string;
  result: TicketScanResult;
  scannedCodeHash: string;
  input: CompleteTicketScanInput;
  scannedAt: Date;
}) {
  return transaction.ticketScan.create({
    data: {
      ticketId,
      performedById:
        scannerId,
      result,
      scannedCodeHash,
      deviceId:
        normalizeText(
          input.deviceId,
        ),
      deviceName:
        normalizeText(
          input.deviceName,
        ),
      gateName:
        normalizeText(
          input.gateName,
        ),
      ipAddress:
        normalizeText(
          input.ipAddress,
        ),
      userAgent:
        normalizeText(
          input.userAgent,
        ),
      latitude:
        decimalOrNull(
          input.latitude,
        ),
      longitude:
        decimalOrNull(
          input.longitude,
        ),
      metadata:
        input.metadata ??
        undefined,
      scannedAt,
    },

    select: {
      id:
        true,
      scannedAt:
        true,
    },
  });
}

export async function completeTicketScan(
  input: CompleteTicketScanInput,
): Promise<CompleteTicketScanResult> {
  const normalizedQrValue =
    input.qrValue.trim();

  if (!normalizedQrValue) {
    throw new ScannerError({
      code:
        "SCANNER_QR_REQUIRED",
      message:
        "Le QR code ou le code du billet est obligatoire.",
      status:
        400,
      retryable:
        false,
    });
  }

  return prisma.$transaction(
    async (
      transaction,
    ) => {
      const verification =
        await verifyTicketForScan({
          scannerId:
            input.scannerId,
          eventId:
            input.eventId,
          qrValue:
            normalizedQrValue,
          transaction,
        });

      const now =
        new Date();

      const scannedCodeHash =
        hashScannedValue(
          normalizedQrValue,
        );

      if (
        !verification.valid
      ) {
        let scanId:
          string | null = null;

        if (verification.ticket) {
          const scan =
            await createKnownTicketScan({
              transaction,
              ticketId:
                verification.ticket.id,
              scannerId:
                input.scannerId,
              result:
                verification.result,
              scannedCodeHash,
              input,
              scannedAt:
                now,
            });

          scanId =
            scan.id;
        }

        return {
          accepted:
            false,
          result:
            verification.result,
          message:
            verification.message,
          scanId,
          scannedAt:
            now,
          ticket:
            verification.ticket,
          authenticity:
            verification.authenticity,
          firstUse:
            verification.ticket
              ? {
                  usedAt:
                    verification.ticket.usedAt,
                  scannedAt:
                    verification.ticket.scannedAt,
                }
              : null,
        };
      }

      if (!verification.ticket) {
        throw new ScannerError({
          code:
            "SCANNER_TICKET_NOT_FOUND",
          message:
            "Le billet n’a pas pu être retrouvé.",
          status:
            404,
          retryable:
            false,
        });
      }

      const updated =
        await transaction.ticket.updateMany({
          where: {
            id:
              verification.ticket.id,
            eventId:
              input.eventId,
            status:
              TicketStatus.VALID,
            usedAt:
              null,
          },

          data: {
            status:
              TicketStatus.USED,
            usedAt:
              now,
            scannedAt:
              now,
          },
        });

      if (
        updated.count !==
        1
      ) {
        const currentTicket =
          await transaction.ticket.findUnique({
            where: {
              id:
                verification.ticket.id,
            },

            select: {
              usedAt:
                true,
              scannedAt:
                true,
              status:
                true,
            },
          });

        const scan =
          await createKnownTicketScan({
            transaction,
            ticketId:
              verification.ticket.id,
            scannerId:
              input.scannerId,
            result:
              TicketScanResult.ALREADY_USED,
            scannedCodeHash,
            input,
            scannedAt:
              now,
          });

        return {
          accepted:
            false,
          result:
            TicketScanResult.ALREADY_USED,
          message:
            "Ce billet vient d’être utilisé ou avait déjà été scanné.",
          scanId:
            scan.id,
          scannedAt:
            now,
          ticket: {
            ...verification.ticket,
            status:
              currentTicket?.status ??
              verification.ticket.status,
            usedAt:
              currentTicket?.usedAt ??
              verification.ticket.usedAt,
            scannedAt:
              currentTicket?.scannedAt ??
              verification.ticket.scannedAt,
          },
          authenticity:
            verification.authenticity,
          firstUse: {
            usedAt:
              currentTicket?.usedAt ??
              null,
            scannedAt:
              currentTicket?.scannedAt ??
              null,
          },
        };
      }

      const scan =
        await createKnownTicketScan({
          transaction,
          ticketId:
            verification.ticket.id,
          scannerId:
            input.scannerId,
          result:
            TicketScanResult.ACCEPTED,
          scannedCodeHash,
          input,
          scannedAt:
            now,
        });

      return {
        accepted:
          true,
        result:
          TicketScanResult.ACCEPTED,
        message:
          "Accès autorisé — Signature Tikemia vérifiée.",
        scanId:
          scan.id,
        scannedAt:
          now,
        ticket: {
          ...verification.ticket,
          status:
            TicketStatus.USED,
          usedAt:
            now,
          scannedAt:
            now,
        },
        authenticity:
          verification.authenticity,
        firstUse: {
          usedAt:
            now,
          scannedAt:
            now,
        },
      };
    },
    {
      isolationLevel:
        Prisma.TransactionIsolationLevel.Serializable,
      maxWait:
        5_000,
      timeout:
        15_000,
    },
  );
}
