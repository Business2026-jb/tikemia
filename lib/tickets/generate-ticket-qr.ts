import "server-only";

import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import * as QRCode from "qrcode";

import {
  PaymentError,
  PaymentValidationError,
} from "@/lib/payments/payment-errors";

export const TICKET_QR_VERSION = 1;

export const TICKET_QR_ISSUER =
  "TIKEMIA" as const;

export const TICKET_QR_PREFIX =
  "TIKEMIA" as const;

const DEFAULT_QR_IMAGE_WIDTH = 640;

const DEFAULT_QR_ERROR_CORRECTION_LEVEL =
  "M" as const;

export type TicketQrUnsignedPayload = {
  version: number;
  issuer: typeof TICKET_QR_ISSUER;

  ticketCode: string;
  orderReference: string;

  eventId: string;
  eventTitle: string;

  ticketTypeId: string;
  ticketCategory: string;

  unitPrice: string;
  currency: string;

  issuedAt: string;
  nonce: string;
};

export type TicketQrPayload =
  TicketQrUnsignedPayload & {
    signature: string;
  };

export type GenerateTicketQrInput = Readonly<{
  ticketCode: string;
  orderReference: string;

  eventId: string;
  eventTitle: string;

  ticketTypeId: string;
  ticketCategory: string;

  unitPrice: string;
  currency: string;

  issuedAt?: Date;
}>;

export type GenerateTicketQrResult = Readonly<{
  version: number;

  value: string;
  tokenHash: string;

  payload: TicketQrPayload;
}>;

export type VerifiedTicketQrResult = Readonly<{
  valid: true;

  value: string;
  tokenHash: string;

  payload: TicketQrUnsignedPayload;
}>;

export type GenerateTicketQrImageOptions =
  Readonly<{
    width?: number;
    margin?: number;
  }>;

export type GeneratedTicketQrImage =
  Readonly<{
    value: string;

    buffer: Buffer;
    dataUrl: string;

    mimeType: "image/png";
    fileSize: number;
    checksum: string;
  }>;

function normalizeText(
  value: string | null | undefined,
): string {
  return value?.trim() ?? "";
}

function normalizeRequiredText({
  value,
  fieldName,
}: {
  value: string | null | undefined;
  fieldName: string;
}): string {
  const normalizedValue =
    normalizeText(value);

  if (!normalizedValue) {
    throw new PaymentValidationError({
      code: "PAYMENT_INVALID_REQUEST",

      message:
        `${fieldName} est obligatoire.`,

      status: 400,

      details: {
        fieldName,
      },
    });
  }

  return normalizedValue;
}

function normalizeCurrency(
  value: string,
): string {
  const currency =
    normalizeRequiredText({
      value,
      fieldName: "La devise",
    }).toUpperCase();

  if (
    !/^[A-Z]{3}$/.test(currency)
  ) {
    throw new PaymentValidationError({
      code: "PAYMENT_INVALID_REQUEST",

      message:
        "La devise du billet doit respecter le format ISO 4217.",

      status: 400,

      details: {
        currency,
      },
    });
  }

  return currency;
}

function normalizeUnitPrice(
  value: string,
): string {
  const unitPrice =
    normalizeRequiredText({
      value,
      fieldName:
        "Le prix unitaire du billet",
    });

  if (
    !/^\d+(?:\.\d{1,2})?$/.test(
      unitPrice,
    )
  ) {
    throw new PaymentValidationError({
      code: "PAYMENT_INVALID_REQUEST",

      message:
        "Le prix unitaire du billet est invalide.",

      status: 400,

      details: {
        unitPrice,
      },
    });
  }

  return unitPrice;
}

function normalizeIssuedAt(
  value: Date | undefined,
): Date {
  const issuedAt =
    value ?? new Date();

  if (
    !(issuedAt instanceof Date) ||
    Number.isNaN(
      issuedAt.getTime(),
    )
  ) {
    throw new PaymentValidationError({
      code: "PAYMENT_INVALID_REQUEST",

      message:
        "La date d’émission du billet est invalide.",

      status: 400,
    });
  }

  return issuedAt;
}

function getTicketQrSecret(): string {
  const secret =
    normalizeText(
      process.env.TICKET_QR_SECRET,
    );

  if (secret.length < 32) {
    throw new PaymentError({
      code:
        "PAYMENT_CONFIGURATION_ERROR",

      message:
        "La configuration de sécurité des QR codes est incomplète.",

      status: 500,

      retryable: false,

      exposeMessage: false,
    });
  }

  return secret;
}

function base64UrlEncode(
  value: string,
): string {
  return Buffer.from(
    value,
    "utf8",
  ).toString("base64url");
}

function base64UrlDecode(
  value: string,
): string {
  try {
    return Buffer.from(
      value,
      "base64url",
    ).toString("utf8");
  } catch (error) {
    throw new PaymentValidationError({
      code: "PAYMENT_INVALID_REQUEST",

      message:
        "Le contenu encodé du QR code est invalide.",

      status: 400,

      cause: error,
    });
  }
}

function hashValue(
  value: string,
): string {
  return createHash("sha256")
    .update(value, "utf8")
    .digest("hex");
}

function createQrSignature(
  encodedPayload: string,
): string {
  return createHmac(
    "sha256",
    getTicketQrSecret(),
  )
    .update(
      encodedPayload,
      "utf8",
    )
    .digest("base64url");
}

function safeEquals(
  left: string,
  right: string,
): boolean {
  const leftBuffer =
    Buffer.from(left, "utf8");

  const rightBuffer =
    Buffer.from(right, "utf8");

  if (
    leftBuffer.length !==
    rightBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    leftBuffer,
    rightBuffer,
  );
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function readRequiredRecordString({
  record,
  key,
  fieldName,
}: {
  record: Record<string, unknown>;
  key: string;
  fieldName: string;
}): string {
  const value =
    record[key];

  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new PaymentValidationError({
      code: "PAYMENT_INVALID_REQUEST",

      message:
        `${fieldName} du QR code est invalide.`,

      status: 400,

      details: {
        fieldName,
      },
    });
  }

  return value.trim();
}

function parseUnsignedPayload(
  encodedPayload: string,
): TicketQrUnsignedPayload {
  let parsed: unknown;

  try {
    parsed = JSON.parse(
      base64UrlDecode(
        encodedPayload,
      ),
    ) as unknown;
  } catch (error) {
    if (
      error instanceof
      PaymentValidationError
    ) {
      throw error;
    }

    throw new PaymentValidationError({
      code: "PAYMENT_INVALID_REQUEST",

      message:
        "Le contenu du QR code est invalide.",

      status: 400,

      cause: error,
    });
  }

  if (!isRecord(parsed)) {
    throw new PaymentValidationError({
      code: "PAYMENT_INVALID_REQUEST",

      message:
        "Le contenu du QR code est invalide.",

      status: 400,
    });
  }

  if (
    parsed.version !==
    TICKET_QR_VERSION
  ) {
    throw new PaymentValidationError({
      code: "PAYMENT_INVALID_REQUEST",

      message:
        "La version du QR code n’est pas prise en charge.",

      status: 400,

      details: {
        receivedVersion:
          parsed.version ?? null,

        supportedVersion:
          TICKET_QR_VERSION,
      },
    });
  }

  if (
    parsed.issuer !==
    TICKET_QR_ISSUER
  ) {
    throw new PaymentValidationError({
      code: "PAYMENT_INVALID_REQUEST",

      message:
        "L’émetteur du QR code est invalide.",

      status: 400,
    });
  }

  const ticketCode =
    readRequiredRecordString({
      record: parsed,
      key: "ticketCode",
      fieldName:
        "Le code du billet",
    });

  const orderReference =
    readRequiredRecordString({
      record: parsed,
      key: "orderReference",
      fieldName:
        "La référence de commande",
    });

  const eventId =
    readRequiredRecordString({
      record: parsed,
      key: "eventId",
      fieldName:
        "L’identifiant de l’événement",
    });

  const eventTitle =
    readRequiredRecordString({
      record: parsed,
      key: "eventTitle",
      fieldName:
        "Le titre de l’événement",
    });

  const ticketTypeId =
    readRequiredRecordString({
      record: parsed,
      key: "ticketTypeId",
      fieldName:
        "L’identifiant de la catégorie",
    });

  const ticketCategory =
    readRequiredRecordString({
      record: parsed,
      key: "ticketCategory",
      fieldName:
        "La catégorie du billet",
    });

  const unitPrice =
    normalizeUnitPrice(
      readRequiredRecordString({
        record: parsed,
        key: "unitPrice",
        fieldName:
          "Le prix unitaire",
      }),
    );

  const currency =
    normalizeCurrency(
      readRequiredRecordString({
        record: parsed,
        key: "currency",
        fieldName: "La devise",
      }),
    );

  const issuedAt =
    readRequiredRecordString({
      record: parsed,
      key: "issuedAt",
      fieldName:
        "La date d’émission",
    });

  if (
    Number.isNaN(
      Date.parse(issuedAt),
    )
  ) {
    throw new PaymentValidationError({
      code: "PAYMENT_INVALID_REQUEST",

      message:
        "La date d’émission du QR code est invalide.",

      status: 400,
    });
  }

  const nonce =
    readRequiredRecordString({
      record: parsed,
      key: "nonce",
      fieldName:
        "Le nonce de sécurité",
    });

  if (nonce.length < 16) {
    throw new PaymentValidationError({
      code: "PAYMENT_INVALID_REQUEST",

      message:
        "Le nonce de sécurité du QR code est invalide.",

      status: 400,
    });
  }

  return {
    version:
      TICKET_QR_VERSION,

    issuer:
      TICKET_QR_ISSUER,

    ticketCode,
    orderReference,

    eventId,
    eventTitle,

    ticketTypeId,
    ticketCategory,

    unitPrice,
    currency,

    issuedAt,
    nonce,
  };
}

function normalizeQrImageWidth(
  value: number | undefined,
): number {
  if (value === undefined) {
    return DEFAULT_QR_IMAGE_WIDTH;
  }

  if (
    !Number.isInteger(value) ||
    value < 128 ||
    value > 2048
  ) {
    throw new PaymentValidationError({
      code: "PAYMENT_INVALID_REQUEST",

      message:
        "La largeur de l’image QR doit être comprise entre 128 et 2048 pixels.",

      status: 400,
    });
  }

  return value;
}

function normalizeQrImageMargin(
  value: number | undefined,
): number {
  if (value === undefined) {
    return 3;
  }

  if (
    !Number.isInteger(value) ||
    value < 0 ||
    value > 20
  ) {
    throw new PaymentValidationError({
      code: "PAYMENT_INVALID_REQUEST",

      message:
        "La marge de l’image QR doit être comprise entre 0 et 20.",

      status: 400,
    });
  }

  return value;
}

export function generateTicketQr(
  input: GenerateTicketQrInput,
): GenerateTicketQrResult {
  const ticketCode =
    normalizeRequiredText({
      value: input.ticketCode,
      fieldName:
        "Le code du billet",
    });

  const orderReference =
    normalizeRequiredText({
      value:
        input.orderReference,
      fieldName:
        "La référence de commande",
    });

  const eventId =
    normalizeRequiredText({
      value: input.eventId,
      fieldName:
        "L’identifiant de l’événement",
    });

  const eventTitle =
    normalizeRequiredText({
      value: input.eventTitle,
      fieldName:
        "Le titre de l’événement",
    });

  const ticketTypeId =
    normalizeRequiredText({
      value:
        input.ticketTypeId,
      fieldName:
        "L’identifiant de la catégorie",
    });

  const ticketCategory =
    normalizeRequiredText({
      value:
        input.ticketCategory,
      fieldName:
        "La catégorie du billet",
    });

  const unitPrice =
    normalizeUnitPrice(
      input.unitPrice,
    );

  const currency =
    normalizeCurrency(
      input.currency,
    );

  const issuedAt =
    normalizeIssuedAt(
      input.issuedAt,
    );

  const nonce =
    randomBytes(24).toString(
      "base64url",
    );

  const unsignedPayload:
    TicketQrUnsignedPayload = {
      version:
        TICKET_QR_VERSION,

      issuer:
        TICKET_QR_ISSUER,

      ticketCode,
      orderReference,

      eventId,
      eventTitle,

      ticketTypeId,
      ticketCategory,

      unitPrice,
      currency,

      issuedAt:
        issuedAt.toISOString(),

      nonce,
    };

  const encodedPayload =
    base64UrlEncode(
      JSON.stringify(
        unsignedPayload,
      ),
    );

  const signature =
    createQrSignature(
      encodedPayload,
    );

  const value =
    `${TICKET_QR_PREFIX}.${encodedPayload}.${signature}`;

  return Object.freeze({
    version:
      TICKET_QR_VERSION,

    value,

    tokenHash:
      hashValue(nonce),

    payload:
      Object.freeze({
        ...unsignedPayload,
        signature,
      }),
  });
}

export function verifyTicketQr(
  qrValue: string,
): VerifiedTicketQrResult {
  const normalizedValue =
    normalizeRequiredText({
      value: qrValue,
      fieldName:
        "Le QR code du billet",
    });

  const parts =
    normalizedValue.split(".");

  if (
    parts.length !== 3 ||
    parts[0] !==
      TICKET_QR_PREFIX
  ) {
    throw new PaymentValidationError({
      code: "PAYMENT_INVALID_REQUEST",

      message:
        "Le format du QR code du billet est invalide.",

      status: 400,
    });
  }

  const encodedPayload =
    normalizeText(parts[1]);

  const receivedSignature =
    normalizeText(parts[2]);

  if (
    !encodedPayload ||
    !receivedSignature
  ) {
    throw new PaymentValidationError({
      code: "PAYMENT_INVALID_REQUEST",

      message:
        "Le QR code du billet est incomplet.",

      status: 400,
    });
  }

  const expectedSignature =
    createQrSignature(
      encodedPayload,
    );

  if (
    !safeEquals(
      receivedSignature,
      expectedSignature,
    )
  ) {
    throw new PaymentValidationError({
      code: "PAYMENT_FORBIDDEN",

      message:
        "La signature du QR code du billet est invalide.",

      status: 403,
    });
  }

  const payload =
    parseUnsignedPayload(
      encodedPayload,
    );

  return Object.freeze({
    valid: true,

    value:
      normalizedValue,

    tokenHash:
      hashValue(payload.nonce),

    payload:
      Object.freeze(payload),
  });
}

/**
 * Alias conservant le nom déjà utilisé dans les fichiers existants.
 *
 * generate-ticket-pdf.ts peut donc importer verifyTicketQrValue()
 * depuis ce nouveau fichier sans modifier sa logique.
 */
export function verifyTicketQrValue(
  qrValue: string,
): VerifiedTicketQrResult {
  return verifyTicketQr(qrValue);
}

export async function generateTicketQrImage(
  qrValue: string,
  options: GenerateTicketQrImageOptions = {},
): Promise<GeneratedTicketQrImage> {
  /*
   * Vérifier le contenu avant de produire l’image empêche la création
   * d’un PNG à partir d’un QR Tikemia falsifié ou incomplet.
   */
  const verified =
    verifyTicketQr(qrValue);

  const width =
    normalizeQrImageWidth(
      options.width,
    );

  const margin =
    normalizeQrImageMargin(
      options.margin,
    );

  try {
    const buffer =
      await QRCode.toBuffer(
        verified.value,
        {
          type: "png",

          width,
          margin,

          errorCorrectionLevel:
            DEFAULT_QR_ERROR_CORRECTION_LEVEL,

          color: {
            dark: "#000000",
            light: "#FFFFFF",
          },
        },
      );

    if (
      !buffer ||
      buffer.byteLength === 0
    ) {
      throw new Error(
        "L’image QR générée est vide.",
      );
    }

    return Object.freeze({
      value:
        verified.value,

      buffer,

      dataUrl:
        `data:image/png;base64,${buffer.toString(
          "base64",
        )}`,

      mimeType:
        "image/png",

      fileSize:
        buffer.byteLength,

      checksum:
        createHash("sha256")
          .update(buffer)
          .digest("hex"),
    });
  } catch (error) {
    if (
      error instanceof
        PaymentValidationError ||
      error instanceof
        PaymentError
    ) {
      throw error;
    }

    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        "Impossible de générer l’image QR du billet.",

      status: 500,

      retryable: true,

      exposeMessage: false,

      cause: error,
    });
  }
}

export function getTicketQrTokenHash(
  qrValue: string,
): string {
  return verifyTicketQr(
    qrValue,
  ).tokenHash;
}

export function assertTicketQrMatches({
  qrValue,
  ticketCode,
  orderReference,
  eventId,
  ticketTypeId,
  qrVersion,
}: {
  qrValue: string;
  ticketCode: string;
  orderReference: string;
  eventId: string;
  ticketTypeId: string;
  qrVersion?: number;
}): VerifiedTicketQrResult {
  const verified =
    verifyTicketQr(qrValue);

  if (
    verified.payload.ticketCode !==
      normalizeText(ticketCode) ||
    verified.payload.orderReference !==
      normalizeText(orderReference) ||
    verified.payload.eventId !==
      normalizeText(eventId) ||
    verified.payload.ticketTypeId !==
      normalizeText(ticketTypeId)
  ) {
    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        "Les informations du QR code ne correspondent pas au billet.",

      status: 500,

      retryable: false,

      exposeMessage: false,

      details: {
        ticketCode,
        orderReference,
        eventId,
        ticketTypeId,
      },
    });
  }

  if (
    qrVersion !== undefined &&
    verified.payload.version !==
      qrVersion
  ) {
    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        "La version du QR code ne correspond pas au billet.",

      status: 500,

      retryable: false,

      exposeMessage: false,

      details: {
        storedQrVersion:
          qrVersion,

        payloadQrVersion:
          verified.payload.version,
      },
    });
  }

  return verified;
}