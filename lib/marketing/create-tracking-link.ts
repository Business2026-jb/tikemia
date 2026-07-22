import {
  MarketingChannel,
} from "@prisma/client";

import {
  createCampaignTrackingCode,
  isValidTrackingCode,
} from "@/lib/marketing/create-tracking-code";

export type TrackingLinkTarget =
  | "event"
  | "campaign"
  | "qr"
  | "partner"
  | "affiliate";

export type CreateTrackingLinkOptions = {
  baseUrl?: string;

  eventSlug?: string | null;
  eventId?: string | null;

  campaignId?: string | null;
  organizerId?: string | null;

  trackingCode?: string | null;

  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  content?: string | null;
  term?: string | null;

  channel?: MarketingChannel | string | null;

  partnerCode?: string | null;
  affiliateCode?: string | null;

  target?: TrackingLinkTarget;

  redirectPath?: string | null;

  includeUtm?: boolean;
  includeTrackingCode?: boolean;

  lowercaseTrackingCode?: boolean;
};

export type TrackingLinkResult = {
  url: string;
  trackingCode: string;
  pathname: string;
  query: Record<string, string>;
};

export class TrackingLinkError extends Error {
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
      "TrackingLinkError";

    this.code =
      code;

    this.cause =
      cause;
  }
}

const DEFAULT_PUBLIC_URL =
  "https://tikemia.com";

const TRACKING_PARAM =
  "tk";

const MAX_URL_LENGTH =
  2_048;

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string {
  return value?.trim() ?? "";
}

function normalizeOptionalText(
  value:
    | string
    | null
    | undefined,
): string | null {
  const normalized =
    normalizeText(value);

  return normalized || null;
}

function normalizeBaseUrl(
  value:
    | string
    | null
    | undefined,
): string {
  const candidate =
    normalizeText(value) ||
    normalizeText(
      process.env.NEXT_PUBLIC_APP_URL,
    ) ||
    normalizeText(
      process.env.APP_URL,
    ) ||
    DEFAULT_PUBLIC_URL;

  let parsed: URL;

  try {
    parsed =
      new URL(candidate);
  } catch (error) {
    throw new TrackingLinkError({
      code:
        "INVALID_TRACKING_BASE_URL",

      message:
        "L’URL publique utilisée pour générer le lien de suivi est invalide.",

      cause:
        error,
    });
  }

  if (
    parsed.protocol !==
      "http:" &&
    parsed.protocol !==
      "https:"
  ) {
    throw new TrackingLinkError({
      code:
        "UNSUPPORTED_TRACKING_PROTOCOL",

      message:
        "Le lien de suivi doit utiliser le protocole HTTP ou HTTPS.",
    });
  }

  parsed.hash =
    "";

  parsed.search =
    "";

  return parsed
    .toString()
    .replace(
      /\/+$/,
      "",
    );
}

function normalizeSlug(
  value:
    | string
    | null
    | undefined,
): string | null {
  const normalized =
    normalizeText(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        "",
      )
      .replace(
        /[^a-z0-9]+/g,
        "-",
      )
      .replace(
        /^-+|-+$/g,
        "");

  return normalized || null;
}

function normalizePath(
  value:
    | string
    | null
    | undefined,
): string | null {
  const normalized =
    normalizeText(value);

  if (!normalized) {
    return null;
  }

  if (
    normalized.startsWith(
      "http://",
    ) ||
    normalized.startsWith(
      "https://",
    )
  ) {
    throw new TrackingLinkError({
      code:
        "ABSOLUTE_REDIRECT_PATH_FORBIDDEN",

      message:
        "Le chemin de redirection doit être un chemin interne à Tikemia.",
    });
  }

  const withLeadingSlash =
    normalized.startsWith("/")
      ? normalized
      : `/${normalized}`;

  const collapsed =
    withLeadingSlash.replace(
      /\/{2,}/g,
      "/",
    );

  if (
    collapsed.includes("..")
  ) {
    throw new TrackingLinkError({
      code:
        "INVALID_REDIRECT_PATH",

      message:
        "Le chemin de redirection contient une séquence interdite.",
    });
  }

  return collapsed;
}

function normalizeQueryValue(
  value:
    | string
    | null
    | undefined,
  maximumLength = 180,
): string | null {
  const normalized =
    normalizeText(value)
      .replace(
        /\s+/g,
        " ",
      )
      .slice(
        0,
        maximumLength,
      );

  return normalized || null;
}

function normalizeChannel(
  value:
    | MarketingChannel
    | string
    | null
    | undefined,
): string | null {
  const normalized =
    normalizeText(
      value,
    )
      .toLowerCase()
      .replace(
        /[^a-z0-9_-]+/g,
        "-",
      )
      .replace(
        /^-+|-+$/g,
        "");

  return normalized || null;
}

function resolvePathname({
  redirectPath,
  eventSlug,
  eventId,
  target,
}: {
  redirectPath:
    | string
    | null;

  eventSlug:
    | string
    | null;

  eventId:
    | string
    | null;

  target:
    TrackingLinkTarget;
}): string {
  if (redirectPath) {
    return redirectPath;
  }

  if (target === "event") {
    if (eventSlug) {
      return `/events/${encodeURIComponent(
        eventSlug,
      )}`;
    }

    if (eventId) {
      return `/events/${encodeURIComponent(
        eventId,
      )}`;
    }
  }

  if (eventSlug) {
    return `/events/${encodeURIComponent(
      eventSlug,
    )}`;
  }

  if (eventId) {
    return `/events/${encodeURIComponent(
      eventId,
    )}`;
  }

  throw new TrackingLinkError({
    code:
      "TRACKING_TARGET_MISSING",

    message:
      "Un événement ou un chemin de redirection est obligatoire pour générer le lien de suivi.",
  });
}

function createQuery({
  trackingCode,
  source,
  medium,
  campaign,
  content,
  term,
  channel,
  partnerCode,
  affiliateCode,
  includeUtm,
  includeTrackingCode,
}: {
  trackingCode:
    string;

  source:
    string | null;

  medium:
    string | null;

  campaign:
    string | null;

  content:
    string | null;

  term:
    string | null;

  channel:
    string | null;

  partnerCode:
    string | null;

  affiliateCode:
    string | null;

  includeUtm:
    boolean;

  includeTrackingCode:
    boolean;
}): Record<string, string> {
  const query:
    Record<
      string,
      string
    > = {};

  if (
    includeTrackingCode
  ) {
    query[
      TRACKING_PARAM
    ] =
      trackingCode;
  }

  if (includeUtm) {
    if (source) {
      query.utm_source =
        source;
    }

    if (
      medium ||
      channel
    ) {
      query.utm_medium =
        medium ||
        channel ||
        "";
    }

    if (campaign) {
      query.utm_campaign =
        campaign;
    }

    if (content) {
      query.utm_content =
        content;
    }

    if (term) {
      query.utm_term =
        term;
    }
  }

  if (channel) {
    query.channel =
      channel;
  }

  if (partnerCode) {
    query.partner =
      partnerCode;
  }

  if (affiliateCode) {
    query.affiliate =
      affiliateCode;
  }

  return query;
}

function appendQueryParameters({
  url,
  query,
}: {
  url: URL;
  query:
    Record<
      string,
      string
    >;
}): void {
  for (
    const [
      key,
      value,
    ] of Object.entries(query)
  ) {
    url.searchParams.set(
      key,
      value,
    );
  }
}

function assertUrlLength(
  value: string,
): void {
  if (
    value.length >
    MAX_URL_LENGTH
  ) {
    throw new TrackingLinkError({
      code:
        "TRACKING_URL_TOO_LONG",

      message:
        "Le lien de suivi généré dépasse la longueur maximale autorisée.",
    });
  }
}

export function createTrackingLink(
  options:
    CreateTrackingLinkOptions,
): TrackingLinkResult {
  try {
    const {
      baseUrl,

      eventSlug:
        rawEventSlug,

      eventId:
        rawEventId,

      campaignId,
      organizerId,

      trackingCode:
        providedTrackingCode,

      source:
        rawSource,

      medium:
        rawMedium,

      campaign:
        rawCampaign,

      content:
        rawContent,

      term:
        rawTerm,

      channel:
        rawChannel,

      partnerCode:
        rawPartnerCode,

      affiliateCode:
        rawAffiliateCode,

      target =
        "event",

      redirectPath:
        rawRedirectPath,

      includeUtm =
        true,

      includeTrackingCode =
        true,

      lowercaseTrackingCode =
        false,
    } = options;

    const normalizedBaseUrl =
      normalizeBaseUrl(
        baseUrl,
      );

    const eventSlug =
      normalizeSlug(
        rawEventSlug,
      );

    const eventId =
      normalizeOptionalText(
        rawEventId,
      );

    const redirectPath =
      normalizePath(
        rawRedirectPath,
      );

    const source =
      normalizeQueryValue(
        rawSource,
        80,
      );

    const medium =
      normalizeQueryValue(
        rawMedium,
        80,
      );

    const campaign =
      normalizeQueryValue(
        rawCampaign,
        120,
      );

    const content =
      normalizeQueryValue(
        rawContent,
        180,
      );

    const term =
      normalizeQueryValue(
        rawTerm,
        120,
      );

    const channel =
      normalizeChannel(
        rawChannel,
      );

    const partnerCode =
      normalizeQueryValue(
        rawPartnerCode,
        80,
      );

    const affiliateCode =
      normalizeQueryValue(
        rawAffiliateCode,
        80,
      );

    const pathname =
      resolvePathname({
        redirectPath,
        eventSlug,
        eventId,
        target,
      });

    let trackingCode =
      normalizeText(
        providedTrackingCode,
      );

    if (!trackingCode) {
      trackingCode =
        createCampaignTrackingCode({
          organizerId,
          eventId,
          campaignId,
          source,
          channel,

          lowercase:
            lowercaseTrackingCode,
        });
    }

    if (
      !isValidTrackingCode(
        trackingCode,
      )
    ) {
      throw new TrackingLinkError({
        code:
          "INVALID_TRACKING_CODE",

        message:
          "Le code de suivi fourni est invalide.",
      });
    }

    const query =
      createQuery({
        trackingCode,

        source,

        medium,

        campaign,

        content,

        term,

        channel,

        partnerCode,

        affiliateCode,

        includeUtm,

        includeTrackingCode,
      });

    const url =
      new URL(
        pathname,
        `${normalizedBaseUrl}/`,
      );

    appendQueryParameters({
      url,
      query,
    });

    const finalUrl =
      url.toString();

    assertUrlLength(
      finalUrl,
    );

    return {
      url:
        finalUrl,

      trackingCode,

      pathname,

      query,
    };
  } catch (error) {
    if (
      error instanceof
      TrackingLinkError
    ) {
      throw error;
    }

    throw new TrackingLinkError({
      code:
        "TRACKING_LINK_GENERATION_FAILED",

      message:
        "Impossible de générer le lien de suivi.",

      cause:
        error,
    });
  }
}

export function createCampaignTrackingLink(
  options:
    Omit<
      CreateTrackingLinkOptions,
      "target"
    >,
): TrackingLinkResult {
  return createTrackingLink({
    ...options,

    target:
      "campaign",
  });
}

export function createQrTrackingLink(
  options:
    Omit<
      CreateTrackingLinkOptions,
      "target"
    >,
): TrackingLinkResult {
  return createTrackingLink({
    ...options,

    target:
      "qr",

    channel:
      options.channel ??
      MarketingChannel.QR_CODE,

    medium:
      options.medium ??
      "qr-code",
  });
}

export function createPartnerTrackingLink(
  options:
    Omit<
      CreateTrackingLinkOptions,
      "target"
    >,
): TrackingLinkResult {
  return createTrackingLink({
    ...options,

    target:
      "partner",

    channel:
      options.channel ??
      MarketingChannel.PARTNER,

    medium:
      options.medium ??
      "partner",
  });
}

export function createAffiliateTrackingLink(
  options:
    Omit<
      CreateTrackingLinkOptions,
      "target"
    >,
): TrackingLinkResult {
  return createTrackingLink({
    ...options,

    target:
      "affiliate",

    channel:
      options.channel ??
      MarketingChannel.AFFILIATE,

    medium:
      options.medium ??
      "affiliate",
  });
}

export function readTrackingCodeFromUrl(
  value:
    | string
    | URL,
): string | null {
  try {
    const url =
      value instanceof URL
        ? value
        : new URL(value);

    const trackingCode =
      normalizeText(
        url.searchParams.get(
          TRACKING_PARAM,
        ),
      );

    return isValidTrackingCode(
      trackingCode,
    )
      ? trackingCode
      : null;
  } catch {
    return null;
  }
}

export function removeTrackingParameters(
  value:
    | string
    | URL,
): string {
  let url: URL;

  try {
    url =
      value instanceof URL
        ? new URL(
            value.toString(),
          )
        : new URL(value);
  } catch (error) {
    throw new TrackingLinkError({
      code:
        "INVALID_TRACKING_URL",

      message:
        "Le lien fourni est invalide.",

      cause:
        error,
    });
  }

  const parameters = [
    TRACKING_PARAM,
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "channel",
    "partner",
    "affiliate",
  ];

  for (
    const parameter of parameters
  ) {
    url.searchParams.delete(
      parameter,
    );
  }

  return url.toString();
}

export default createTrackingLink;