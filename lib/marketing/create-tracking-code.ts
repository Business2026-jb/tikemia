import {
  createHash,
  randomBytes,
} from "node:crypto";

export type TrackingCodeEntity =
  | "campaign"
  | "qr"
  | "partner"
  | "affiliate"
  | "promo"
  | "event"
  | "source";

export type CreateTrackingCodeOptions = {
  entity?:
    TrackingCodeEntity;

  prefix?: string;

  length?: number;

  organizerId?: string | null;
  eventId?: string | null;
  campaignId?: string | null;

  source?: string | null;
  channel?: string | null;

  includeTimestamp?: boolean;

  lowercase?: boolean;
};

export type ParsedTrackingCode = {
  prefix: string;
  timestamp: string | null;
  randomPart: string;
};

export class TrackingCodeError extends Error {
  readonly code: string;
  readonly cause?: unknown;

  constructor({
    code,
    message,
    cause,
  }: {
    code: string;
    message: string;
    cause?: unknown;
  }) {
    super(message);

    this.name =
      "TrackingCodeError";

    this.code =
      code;

    this.cause =
      cause;
  }
}

const DEFAULT_PREFIX =
  "TMK";

const DEFAULT_RANDOM_LENGTH =
  14;

const MIN_RANDOM_LENGTH =
  8;

const MAX_RANDOM_LENGTH =
  48;

const TRACKING_CODE_SEPARATOR =
  "-";

const ENTITY_PREFIXES:
  Record<
    TrackingCodeEntity,
    string
  > = {
    campaign:
      "CMP",

    qr:
      "QR",

    partner:
      "PRT",

    affiliate:
      "AFF",

    promo:
      "PRO",

    event:
      "EVT",

    source:
      "SRC",
  };

const SAFE_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string {
  return value?.trim() ?? "";
}

function normalizePrefix(
  value:
    | string
    | null
    | undefined,
): string {
  const normalized =
    normalizeText(value)
      .toUpperCase()
      .replace(
        /[^A-Z0-9]/g,
        "",
      )
      .slice(
        0,
        12,
      );

  return normalized ||
    DEFAULT_PREFIX;
}

function normalizeRandomLength(
  value:
    | number
    | null
    | undefined,
): number {
  if (
    typeof value !==
      "number" ||
    !Number.isFinite(value)
  ) {
    return DEFAULT_RANDOM_LENGTH;
  }

  return Math.min(
    Math.max(
      Math.floor(value),
      MIN_RANDOM_LENGTH,
    ),
    MAX_RANDOM_LENGTH,
  );
}

function normalizeOptionalToken(
  value:
    | string
    | null
    | undefined,
): string {
  return normalizeText(value)
    .toUpperCase()
    .replace(
      /[^A-Z0-9]/g,
      "",
    )
    .slice(
      0,
      24,
    );
}

function createRandomSegment(
  length: number,
): string {
  const bytes =
    randomBytes(length);

  let output =
    "";

  for (
    let index = 0;
    index < length;
    index += 1
  ) {
    const byte =
      bytes[index] ?? 0;

    output +=
      SAFE_ALPHABET[
        byte %
          SAFE_ALPHABET.length
      ];
  }

  return output;
}

function createTimestampSegment(): string {
  return Date.now()
    .toString(36)
    .toUpperCase();
}

function createContextHash({
  organizerId,
  eventId,
  campaignId,
  source,
  channel,
}: {
  organizerId?:
    string | null;

  eventId?:
    string | null;

  campaignId?:
    string | null;

  source?:
    string | null;

  channel?:
    string | null;
}): string | null {
  const payload = [
    normalizeText(
      organizerId,
    ),

    normalizeText(
      eventId,
    ),

    normalizeText(
      campaignId,
    ),

    normalizeText(
      source,
    ),

    normalizeText(
      channel,
    ),
  ]
    .filter(Boolean)
    .join("|");

  if (!payload) {
    return null;
  }

  return createHash(
    "sha256",
  )
    .update(payload)
    .digest("hex")
    .slice(
      0,
      8,
    )
    .toUpperCase();
}

function assertValidTrackingCode(
  value: string,
): void {
  if (
    !value ||
    value.length <
      MIN_RANDOM_LENGTH
  ) {
    throw new TrackingCodeError({
      code:
        "TRACKING_CODE_TOO_SHORT",

      message:
        "Le code de suivi généré est trop court.",
    });
  }

  if (
    value.length >
      120
  ) {
    throw new TrackingCodeError({
      code:
        "TRACKING_CODE_TOO_LONG",

      message:
        "Le code de suivi généré est trop long.",
    });
  }

  if (
    !/^[A-Za-z0-9_-]+$/.test(
      value,
    )
  ) {
    throw new TrackingCodeError({
      code:
        "TRACKING_CODE_INVALID_CHARACTERS",

      message:
        "Le code de suivi contient des caractères non autorisés.",
    });
  }
}

export function createTrackingCode(
  options:
    CreateTrackingCodeOptions = {},
): string {
  try {
    const {
      entity =
        "campaign",

      prefix,

      length =
        DEFAULT_RANDOM_LENGTH,

      organizerId,
      eventId,
      campaignId,

      source,
      channel,

      includeTimestamp =
        true,

      lowercase =
        false,
    } = options;

    const normalizedLength =
      normalizeRandomLength(
        length,
      );

    const entityPrefix =
      ENTITY_PREFIXES[
        entity
      ] ??
      ENTITY_PREFIXES.campaign;

    const normalizedPrefix =
      normalizePrefix(
        prefix,
      );

    const timestampSegment =
      includeTimestamp
        ? createTimestampSegment()
        : null;

    const contextHash =
      createContextHash({
        organizerId,
        eventId,
        campaignId,
        source:
          normalizeOptionalToken(
            source,
          ),
        channel:
          normalizeOptionalToken(
            channel,
          ),
      });

    const randomSegment =
      createRandomSegment(
        normalizedLength,
      );

    const segments = [
      normalizedPrefix,

      entityPrefix,

      timestampSegment,

      contextHash,

      randomSegment,
    ].filter(
      (
        segment,
      ): segment is string =>
        Boolean(segment),
    );

    const trackingCode =
      segments.join(
        TRACKING_CODE_SEPARATOR,
      );

    assertValidTrackingCode(
      trackingCode,
    );

    return lowercase
      ? trackingCode.toLowerCase()
      : trackingCode;
  } catch (error) {
    if (
      error instanceof
      TrackingCodeError
    ) {
      throw error;
    }

    throw new TrackingCodeError({
      code:
        "TRACKING_CODE_GENERATION_FAILED",

      message:
        "Impossible de générer le code de suivi.",

      cause:
        error,
    });
  }
}

export function isValidTrackingCode(
  value:
    | string
    | null
    | undefined,
): boolean {
  const normalized =
    normalizeText(value);

  if (
    normalized.length <
      MIN_RANDOM_LENGTH ||
    normalized.length >
      120
  ) {
    return false;
  }

  return /^[A-Za-z0-9_-]+$/.test(
    normalized,
  );
}

export function parseTrackingCode(
  value:
    | string
    | null
    | undefined,
): ParsedTrackingCode | null {
  const normalized =
    normalizeText(value);

  if (
    !isValidTrackingCode(
      normalized,
    )
  ) {
    return null;
  }

  const segments =
    normalized.split(
      TRACKING_CODE_SEPARATOR,
    );

  if (
    segments.length <
      3
  ) {
    return null;
  }

  const prefix =
    segments
      .slice(
        0,
        2,
      )
      .join(
        TRACKING_CODE_SEPARATOR,
      );

  const randomPart =
    segments.at(-1) ??
    "";

  const possibleTimestamp =
    segments.length >=
      4
      ? segments[2] ??
        null
      : null;

  return {
    prefix,

    timestamp:
      possibleTimestamp,

    randomPart,
  };
}

export function createCampaignTrackingCode(
  options:
    Omit<
      CreateTrackingCodeOptions,
      "entity"
    > = {},
): string {
  return createTrackingCode({
    ...options,

    entity:
      "campaign",
  });
}

export function createQrTrackingCode(
  options:
    Omit<
      CreateTrackingCodeOptions,
      "entity"
    > = {},
): string {
  return createTrackingCode({
    ...options,

    entity:
      "qr",
  });
}

export function createPartnerTrackingCode(
  options:
    Omit<
      CreateTrackingCodeOptions,
      "entity"
    > = {},
): string {
  return createTrackingCode({
    ...options,

    entity:
      "partner",
  });
}

export default createTrackingCode;