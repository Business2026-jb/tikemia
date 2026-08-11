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

/*
 * L'interface scanner Tikemia ne doit présenter que trois
 * décisions opérationnelles à l'agent :
 *
 * ACCEPTED     => VALIDE
 * ALREADY_USED => DÉJÀ UTILISÉ
 * INVALID      => FAUX BILLET
 *
 * Les résultats techniques plus précis (WRONG_EVENT, etc.)
 * restent enregistrés dans TicketScan lorsqu'un billet connu
 * existe, afin de conserver un audit complet.
 */
function getOperationalResult(
  verificationResult: TicketScanResult,
): TicketScanResult {
  if (
    verificationResult ===
    TicketScanResult.ALREADY_USED
  ) {
    return TicketScanResult.ALREADY_USED;
  }

  return TicketScanResult.INVALID;
}

function getOperationalMessage(
  result: TicketScanResult,
): string {
  if (
    result ===
    TicketScanResult.ALREADY_USED
  ) {
    return "Billet déjà utilisé — entrée refusée.";
  }

  if (
    result ===
    TicketScanResult.ACCEPTED
  ) {
    return "Billet valide — entrée autorisée.";
  }

  return "Faux billet — entrée refusée.";
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
      /*
       * 1. Vérification cryptographique / base de données.
       *
       * Cette fonction reste la source de vérité pour déterminer
       * si le QR correspond réellement à un billet Tikemia.
       */
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

      /*
       * 2. Billet refusé avant consommation.
       *
       * On conserve le résultat technique réel dans l'audit
       * TicketScan lorsqu'on connaît le billet.
       *
       * En revanche, la réponse destinée à l'agent est normalisée
       * en seulement :
       * - ALREADY_USED
       * - INVALID
       */
      if (
        !verification.valid
      ) {
        let scanId:
          string | null = null;

        if (
          verification.ticket
        ) {
          const scan =
            await createKnownTicketScan({
              transaction,

              ticketId:
                verification.ticket.id,

              scannerId:
                input.scannerId,

              /*
               * Audit détaillé :
               * on garde WRONG_EVENT, INVALID, ALREADY_USED, etc.
               * tel que déterminé par verifyTicketForScan().
               */
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

        const operationalResult =
          getOperationalResult(
            verification.result,
          );

        return {
          accepted:
            false,

          result:
            operationalResult,

          message:
            getOperationalMessage(
              operationalResult,
            ),

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

      /*
       * Une vérification valide doit toujours fournir le billet.
       * Si ce n'est pas le cas, on arrête immédiatement :
       * aucun billet ne doit être consommé sans identité certaine.
       */
      if (
        !verification.ticket
      ) {
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

      /*
       * 3. Consommation atomique.
       *
       * updateMany avec :
       * - id
       * - eventId
       * - status VALID
       * - usedAt null
       *
       * garantit qu'un même billet ne peut être validé qu'une seule fois,
       * même si deux scanners tentent de le consommer presque simultanément.
       */
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

      /*
       * 4. Le billet était valide lors de la vérification,
       * mais n'a pas pu être consommé.
       *
       * Le cas normal est une collision concurrente :
       * un autre terminal vient de le scanner juste avant nous.
       *
       * La décision opérationnelle est donc DÉJÀ UTILISÉ.
       */
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
            getOperationalMessage(
              TicketScanResult.ALREADY_USED,
            ),

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

      /*
       * 5. Validation réussie.
       *
       * Le billet vient d'être consommé atomiquement.
       */
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
          getOperationalMessage(
            TicketScanResult.ACCEPTED,
          ),

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
      /*
       * Serializable + update conditionnel protège contre les doubles
       * validations concurrentes provenant de plusieurs terminaux.
       */
      isolationLevel:
        Prisma.TransactionIsolationLevel.Serializable,

      maxWait:
        5_000,

      timeout:
        15_000,
    },
  );
}