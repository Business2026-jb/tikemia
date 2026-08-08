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
  assertScannerCanAccessEvent,
  type ScannerEventPermission,
} from "@/lib/scanner/scanner-permissions";
import {
  verifyTicketQrValue,
  type VerifiedTicketQrResult,
} from "@/lib/tickets/generate-ticket-qr";

type ScanVerificationDatabase =
  Pick<
    Prisma.TransactionClient,
    "ticket"
  >;

const ticketSelect = {
  id:
    true,

  code:
    true,

  qrCodeValue:
    true,

  qrTokenHash:
    true,

  qrVersion:
    true,

  status:
    true,

  holderName:
    true,

  holderEmail:
    true,

  holderPhone:
    true,

  usedAt:
    true,

  scannedAt:
    true,

  event: {
    select: {
      id:
        true,

      title:
        true,

      slug:
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
    },
  },

  ticketType: {
    select: {
      id:
        true,

      name:
        true,

      description:
        true,
    },
  },
} satisfies Prisma.TicketSelect;

type TicketLookupResult =
  Prisma.TicketGetPayload<{
    select:
      typeof ticketSelect;
  }>;

export type VerifiedTicketInformation =
  Readonly<{
    id: string;
    code: string;
    qrVersion: number;
    status: TicketStatus;
    holderName: string;
    holderEmail: string;
    holderPhone: string | null;
    usedAt: Date | null;
    scannedAt: Date | null;

    event: Readonly<{
      id: string;
      title: string;
      slug: string;
      startsAt: Date;
      endsAt: Date | null;
      venueName: string;
      city: string;
      country: string;
      timezone: string;
    }>;

    ticketType: Readonly<{
      id: string;
      name: string;
      description: string | null;
    }>;
  }>;

export type TicketAuthenticity =
  Readonly<{
    verified: boolean;

    label:
      | "Signature Tikemia vérifiée"
      | "Code Tikemia vérifié";

    verificationMode:
      | "SIGNED_QR"
      | "DATABASE_QR"
      | "MANUAL_CODE";

    qrVersion: number;
    fingerprint: string;
  }>;

export type TicketScanVerification =
  Readonly<{
    valid: boolean;
    result: TicketScanResult;
    message: string;
    permission: ScannerEventPermission;
    ticket: VerifiedTicketInformation | null;
    authenticity: TicketAuthenticity | null;
  }>;

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string {
  return value?.trim() ?? "";
}

function hashValue(
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

function buildFingerprint(
  qrValue: string,
): string {
  return hashValue(
    qrValue,
  ).slice(
    0,
    16,
  );
}

function getDatabase(
  transaction?:
    | Prisma.TransactionClient
    | null,
): ScanVerificationDatabase {
  return (
    transaction ??
    prisma
  ) as ScanVerificationDatabase;
}

function isSignedQrValue(
  value: string,
): boolean {
  return (
    value.startsWith(
      "TKM2.",
    ) ||
    value.startsWith(
      "TIKEMIA.",
    )
  );
}

function mapTicketStatusToScanResult(
  status: TicketStatus,
): TicketScanResult {
  switch (status) {
    case TicketStatus.USED:
      return TicketScanResult.ALREADY_USED;

    case TicketStatus.CANCELLED:
      return TicketScanResult.CANCELLED;

    case TicketStatus.REFUNDED:
      return TicketScanResult.REFUNDED;

    case TicketStatus.REVOKED:
      return TicketScanResult.REVOKED;

    case TicketStatus.EXPIRED:
      return TicketScanResult.EXPIRED;

    case TicketStatus.VALID:
    default:
      return TicketScanResult.ERROR;
  }
}

function getTicketStatusMessage(
  status: TicketStatus,
): string {
  switch (status) {
    case TicketStatus.USED:
      return "Ce billet a déjà été utilisé.";

    case TicketStatus.CANCELLED:
      return "Ce billet a été annulé.";

    case TicketStatus.REFUNDED:
      return "Ce billet a été remboursé.";

    case TicketStatus.REVOKED:
      return "Ce billet a été révoqué.";

    case TicketStatus.EXPIRED:
      return "Ce billet a expiré.";

    case TicketStatus.VALID:
    default:
      return "Ce billet ne peut pas être accepté.";
  }
}

function buildTicketInformation(
  ticket: TicketLookupResult,
): VerifiedTicketInformation {
  return {
    id:
      ticket.id,

    code:
      ticket.code,

    qrVersion:
      ticket.qrVersion,

    status:
      ticket.status,

    holderName:
      ticket.holderName,

    holderEmail:
      ticket.holderEmail,

    holderPhone:
      ticket.holderPhone,

    usedAt:
      ticket.usedAt,

    scannedAt:
      ticket.scannedAt,

    event: {
      id:
        ticket.event.id,

      title:
        ticket.event.title,

      slug:
        ticket.event.slug,

      startsAt:
        ticket.event.startsAt,

      endsAt:
        ticket.event.endsAt,

      venueName:
        ticket.event.venueName,

      city:
        ticket.event.city,

      country:
        ticket.event.country,

      timezone:
        ticket.event.timezone,
    },

    ticketType: {
      id:
        ticket.ticketType.id,

      name:
        ticket.ticketType.name,

      description:
        ticket.ticketType.description,
    },
  };
}

function buildSignedQrAuthenticity({
  verifiedQr,
  qrValue,
}: {
  verifiedQr: VerifiedTicketQrResult;
  qrValue: string;
}): TicketAuthenticity {
  return {
    verified:
      true,

    label:
      "Signature Tikemia vérifiée",

    verificationMode:
      "SIGNED_QR",

    qrVersion:
      verifiedQr.payload.version,

    fingerprint:
      buildFingerprint(
        qrValue,
      ),
  };
}

function buildDatabaseAuthenticity({
  qrVersion,
  qrValue,
}: {
  qrVersion: number;
  qrValue: string;
}): TicketAuthenticity {
  return {
    verified:
      true,

    label:
      "Code Tikemia vérifié",

    verificationMode:
      "DATABASE_QR",

    qrVersion,

    fingerprint:
      buildFingerprint(
        qrValue,
      ),
  };
}

function buildManualCodeAuthenticity({
  qrVersion,
  qrValue,
}: {
  qrVersion: number;
  qrValue: string;
}): TicketAuthenticity {
  return {
    verified:
      true,

    label:
      "Code Tikemia vérifié",

    verificationMode:
      "MANUAL_CODE",

    qrVersion,

    fingerprint:
      buildFingerprint(
        qrValue,
      ),
  };
}

function signedQrMatchesTicket({
  verifiedQr,
  ticket,
}: {
  verifiedQr: VerifiedTicketQrResult;
  ticket: TicketLookupResult;
}): boolean {
  if (!ticket.qrTokenHash) {
    return false;
  }

  return (
    verifiedQr.payload.ticketCode ===
      ticket.code &&
    verifiedQr.payload.eventId ===
      ticket.event.id &&
    verifiedQr.payload.ticketTypeId ===
      ticket.ticketType.id &&
    verifiedQr.payload.version ===
      ticket.qrVersion &&
    verifiedQr.tokenHash ===
      ticket.qrTokenHash
  );
}

async function findTicket({
  database,
  normalizedQrValue,
  verifiedQr,
}: {
  database: ScanVerificationDatabase;
  normalizedQrValue: string;
  verifiedQr: VerifiedTicketQrResult | null;
}): Promise<TicketLookupResult | null> {
  if (verifiedQr) {
    return database.ticket.findFirst({
      where: {
        OR: [
          {
            qrTokenHash:
              verifiedQr.tokenHash,
          },

          {
            qrCodeValue:
              normalizedQrValue,
          },

          {
            code:
              verifiedQr.payload.ticketCode,
          },
        ],
      },

      select:
        ticketSelect,
    });
  }

  return database.ticket.findFirst({
    where: {
      OR: [
        {
          qrCodeValue:
            normalizedQrValue,
        },

        {
          code:
            normalizedQrValue,
        },
      ],
    },

    select:
      ticketSelect,
  });
}

export async function verifyTicketForScan({
  scannerId,
  eventId,
  qrValue,
  transaction,
}: {
  scannerId: string;
  eventId: string;
  qrValue: string;
  transaction?:
    | Prisma.TransactionClient
    | null;
}): Promise<TicketScanVerification> {
  const normalizedQrValue =
    normalizeText(
      qrValue,
    );

  const permission =
    await assertScannerCanAccessEvent({
      scannerId,
      eventId,
      transaction,
    });

  if (!normalizedQrValue) {
    return {
      valid:
        false,

      result:
        TicketScanResult.INVALID,

      message:
        "Le QR code ou le code du billet est vide.",

      permission,

      ticket:
        null,

      authenticity:
        null,
    };
  }

  const database =
    getDatabase(
      transaction,
    );

  let verifiedQr:
    VerifiedTicketQrResult | null =
    null;

  if (
    isSignedQrValue(
      normalizedQrValue,
    )
  ) {
    try {
      verifiedQr =
        verifyTicketQrValue(
          normalizedQrValue,
        );
    } catch {
      return {
        valid:
          false,

        result:
          TicketScanResult.INVALID,

        message:
          "La signature du QR code Tikemia est invalide.",

        permission,

        ticket:
          null,

        authenticity:
          null,
      };
    }
  }

  const ticket =
    await findTicket({
      database,

      normalizedQrValue,

      verifiedQr,
    });

  if (!ticket) {
    return {
      valid:
        false,

      result:
        TicketScanResult.INVALID,

      message:
        "Ce QR code n’appartient à aucun billet Tikemia.",

      permission,

      ticket:
        null,

      authenticity:
        null,
    };
  }

  const ticketInformation =
    buildTicketInformation(
      ticket,
    );

  if (
    verifiedQr &&
    !signedQrMatchesTicket({
      verifiedQr,
      ticket,
    })
  ) {
    return {
      valid:
        false,

      result:
        TicketScanResult.INVALID,

      message:
        "Les informations signées du QR code ne correspondent pas au billet.",

      permission,

      ticket:
        ticketInformation,

      authenticity:
        null,
    };
  }

  let authenticity:
    TicketAuthenticity;

  if (verifiedQr) {
    authenticity =
      buildSignedQrAuthenticity({
        verifiedQr,

        qrValue:
          normalizedQrValue,
      });
  } else if (
    normalizedQrValue ===
    ticket.qrCodeValue
  ) {
    authenticity =
      buildDatabaseAuthenticity({
        qrVersion:
          ticket.qrVersion,

        qrValue:
          normalizedQrValue,
      });
  } else {
    authenticity =
      buildManualCodeAuthenticity({
        qrVersion:
          ticket.qrVersion,

        qrValue:
          normalizedQrValue,
      });
  }

  if (
    ticket.event.id !==
    permission.event.id
  ) {
    return {
      valid:
        false,

      result:
        TicketScanResult.WRONG_EVENT,

      message:
        "Ce billet appartient à un autre événement.",

      permission,

      ticket:
        ticketInformation,

      authenticity,
    };
  }

  if (
    ticket.status !==
    TicketStatus.VALID
  ) {
    return {
      valid:
        false,

      result:
        mapTicketStatusToScanResult(
          ticket.status,
        ),

      message:
        getTicketStatusMessage(
          ticket.status,
        ),

      permission,

      ticket:
        ticketInformation,

      authenticity,
    };
  }

  return {
    valid:
      true,

    result:
      TicketScanResult.ACCEPTED,

    message:
      "Billet Tikemia valide. Accès autorisé.",

    permission,

    ticket:
      ticketInformation,

    authenticity,
  };
}