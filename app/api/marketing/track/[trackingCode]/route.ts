import {
  createHash,
  randomBytes,
} from "node:crypto";

import {
  MarketingCampaignStatus,
  MarketingVisitType,
} from "@prisma/client";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VISITOR_COOKIE_NAME =
  "tikemia_marketing_visitor";

const SESSION_COOKIE_NAME =
  "tikemia_marketing_session";

const VISITOR_COOKIE_MAX_AGE =
  60 * 60 * 24 * 365;

const SESSION_COOKIE_MAX_AGE =
  60 * 30;

const MAX_TRACKING_CODE_LENGTH =
  120;

const MAX_SOURCE_LENGTH =
  80;

const MAX_MEDIUM_LENGTH =
  80;

const MAX_REFERRER_LENGTH =
  500;

const MAX_USER_AGENT_LENGTH =
  500;

const MAX_LANDING_URL_LENGTH =
  2_048;

const TRACKING_CODE_PATTERN =
  /^[A-Za-z0-9_-]+$/;

const BOT_USER_AGENT_PATTERN =
  /bot|crawler|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegrambot|discordbot|linkedinbot|twitterbot|preview/i;

type RouteContext = {
  params: Promise<{
    trackingCode: string;
  }>;
};

type CampaignForTracking = {
  id: string;
  organizerId: string;
  eventId: string;
  name: string;
  source: string | null;
  medium: string | null;
  channel: string;
  status: MarketingCampaignStatus;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
  event: {
    id: string;
    slug: string;
    status: string;
  };
};

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string {
  return value?.trim() ?? "";
}

function truncate(
  value:
    | string
    | null
    | undefined,
  maximumLength: number,
): string | null {
  const normalized =
    normalizeText(value)
      .replace(/\s+/g, " ")
      .slice(0, maximumLength);

  return normalized || null;
}

function normalizeTrackingCode(
  value:
    | string
    | null
    | undefined,
): string {
  const normalized =
    normalizeText(value);

  if (
    !normalized ||
    normalized.length >
      MAX_TRACKING_CODE_LENGTH ||
    !TRACKING_CODE_PATTERN.test(
      normalized,
    )
  ) {
    return "";
  }

  return normalized;
}

function getHashSecret(): string {
  return (
    normalizeText(
      process.env
        .MARKETING_TRACKING_HASH_SECRET,
    ) ||
    normalizeText(
      process.env
        .PAYOUT_DESTINATION_ENCRYPTION_KEY,
    ) ||
    normalizeText(
      process.env
        .SESSION_SECRET,
    ) ||
    "tikemia-marketing-tracking"
  );
}

function hashValue(
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

  return createHash("sha256")
    .update(
      `${getHashSecret()}:${normalized}`,
    )
    .digest("hex");
}

function createOpaqueToken(): string {
  return randomBytes(24)
    .toString("base64url");
}

function getClientIp(
  request:
    NextRequest,
): string | null {
  const forwardedFor =
    request.headers.get(
      "x-forwarded-for",
    );

  if (forwardedFor) {
    const firstIp =
      forwardedFor
        .split(",")[0]
        ?.trim();

    if (firstIp) {
      return firstIp;
    }
  }

  return (
    truncate(
      request.headers.get(
        "x-real-ip",
      ),
      120,
    ) ||
    truncate(
      request.headers.get(
        "cf-connecting-ip",
      ),
      120,
    )
  );
}

function isKnownBot(
  userAgent:
    string | null,
): boolean {
  return Boolean(
    userAgent &&
    BOT_USER_AGENT_PATTERN.test(
      userAgent,
    ),
  );
}

function campaignCanTrack(
  campaign:
    CampaignForTracking,
  now:
    Date,
): boolean {
  if (
    !campaign.isActive ||
    campaign.status ===
      MarketingCampaignStatus.ARCHIVED ||
    campaign.status ===
      MarketingCampaignStatus.PAUSED ||
    campaign.status ===
      MarketingCampaignStatus.DRAFT
  ) {
    return false;
  }

  if (
    campaign.startsAt &&
    campaign.startsAt.getTime() >
      now.getTime()
  ) {
    return false;
  }

  if (
    campaign.endsAt &&
    campaign.endsAt.getTime() <
      now.getTime()
  ) {
    return false;
  }

  return true;
}

function createFallbackUrl(
  request:
    NextRequest,
): URL {
  return new URL(
    "/events",
    request.url,
  );
}

function createEventDestinationUrl({
  request,
  campaign,
  trackingCode,
}: {
  request:
    NextRequest;
  campaign:
    CampaignForTracking;
  trackingCode:
    string;
}): URL {
  const destination =
    new URL(
      `/events/${encodeURIComponent(
        campaign.event.slug,
      )}`,
      request.url,
    );

  destination.searchParams.set(
    "tk",
    trackingCode,
  );

  const incomingSource =
    truncate(
      request.nextUrl.searchParams.get(
        "utm_source",
      ),
      MAX_SOURCE_LENGTH,
    );

  const incomingMedium =
    truncate(
      request.nextUrl.searchParams.get(
        "utm_medium",
      ),
      MAX_MEDIUM_LENGTH,
    );

  const source =
    incomingSource ||
    truncate(
      campaign.source,
      MAX_SOURCE_LENGTH,
    );

  const medium =
    incomingMedium ||
    truncate(
      campaign.medium,
      MAX_MEDIUM_LENGTH,
    ) ||
    truncate(
      campaign.channel
        .toLowerCase()
        .replace(
          /[^a-z0-9_-]+/g,
          "-",
        ),
      MAX_MEDIUM_LENGTH,
    );

  if (source) {
    destination.searchParams.set(
      "utm_source",
      source,
    );
  }

  if (medium) {
    destination.searchParams.set(
      "utm_medium",
      medium,
    );
  }

  destination.searchParams.set(
    "utm_campaign",
    campaign.name.slice(
      0,
      120,
    ),
  );

  const passthroughParameters = [
    "utm_content",
    "utm_term",
    "channel",
    "partner",
    "affiliate",
  ] as const;

  for (
    const parameter of
    passthroughParameters
  ) {
    const value =
      truncate(
        request.nextUrl.searchParams.get(
          parameter,
        ),
        180,
      );

    if (value) {
      destination.searchParams.set(
        parameter,
        value,
      );
    }
  }

  return destination;
}

function createRedirectResponse(
  destination:
    URL,
): NextResponse {
  const response =
    NextResponse.redirect(
      destination,
      {
        status:
          302,
      },
    );

  response.headers.set(
    "Cache-Control",
    "private, no-store, max-age=0",
  );

  response.headers.set(
    "Pragma",
    "no-cache",
  );

  response.headers.set(
    "X-Robots-Tag",
    "noindex, nofollow, noarchive",
  );

  response.headers.set(
    "Referrer-Policy",
    "strict-origin-when-cross-origin",
  );

  return response;
}

function setTrackingCookies({
  response,
  visitorToken,
  sessionToken,
}: {
  response:
    NextResponse;
  visitorToken:
    string;
  sessionToken:
    string;
}): void {
  const secure =
    process.env.NODE_ENV ===
    "production";

  response.cookies.set({
    name:
      VISITOR_COOKIE_NAME,
    value:
      visitorToken,
    httpOnly:
      true,
    secure,
    sameSite:
      "lax",
    path:
      "/",
    maxAge:
      VISITOR_COOKIE_MAX_AGE,
  });

  response.cookies.set({
    name:
      SESSION_COOKIE_NAME,
    value:
      sessionToken,
    httpOnly:
      true,
    secure,
    sameSite:
      "lax",
    path:
      "/",
    maxAge:
      SESSION_COOKIE_MAX_AGE,
  });
}

async function findCampaign(
  trackingCode:
    string,
): Promise<CampaignForTracking | null> {
  return prisma.marketingCampaign.findUnique({
    where: {
      trackingCode,
    },

    select: {
      id:
        true,
      organizerId:
        true,
      eventId:
        true,
      name:
        true,
      source:
        true,
      medium:
        true,
      channel:
        true,
      status:
        true,
      startsAt:
        true,
      endsAt:
        true,
      isActive:
        true,

      event: {
        select: {
          id:
            true,
          slug:
            true,
          status:
            true,
        },
      },
    },
  });
}

async function recordVisit({
  request,
  campaign,
  destination,
  visitorToken,
  sessionToken,
}: {
  request:
    NextRequest;
  campaign:
    CampaignForTracking;
  destination:
    URL;
  visitorToken:
    string;
  sessionToken:
    string;
}): Promise<void> {
  const userAgent =
    truncate(
      request.headers.get(
        "user-agent",
      ),
      MAX_USER_AGENT_LENGTH,
    );

  if (
    request.method === "HEAD" ||
    isKnownBot(userAgent)
  ) {
    return;
  }

  const source =
    truncate(
      request.nextUrl.searchParams.get(
        "utm_source",
      ),
      MAX_SOURCE_LENGTH,
    ) ||
    truncate(
      campaign.source,
      MAX_SOURCE_LENGTH,
    );

  const medium =
    truncate(
      request.nextUrl.searchParams.get(
        "utm_medium",
      ),
      MAX_MEDIUM_LENGTH,
    ) ||
    truncate(
      campaign.medium,
      MAX_MEDIUM_LENGTH,
    );

  const referrer =
    truncate(
      request.headers.get(
        "referer",
      ),
      MAX_REFERRER_LENGTH,
    );

  const landingUrl =
    truncate(
      destination.toString(),
      MAX_LANDING_URL_LENGTH,
    );

  await prisma.marketingCampaignVisit.create({
    data: {
      organizerId:
        campaign.organizerId,

      eventId:
        campaign.eventId,

      campaignId:
        campaign.id,

      visitType:
        MarketingVisitType.LINK,

      visitorHash:
        hashValue(
          visitorToken,
        ),

      sessionHash:
        hashValue(
          sessionToken,
        ),

      ipHash:
        hashValue(
          getClientIp(
            request,
          ),
        ),

      source,

      medium,

      referrer,

      userAgent,

      landingUrl,
    },
  });
}

async function handleTrackingRequest(
  request:
    NextRequest,
  context:
    RouteContext,
): Promise<NextResponse> {
  const {
    trackingCode:
      rawTrackingCode,
  } =
    await context.params;

  const trackingCode =
    normalizeTrackingCode(
      rawTrackingCode,
    );

  if (!trackingCode) {
    return createRedirectResponse(
      createFallbackUrl(
        request,
      ),
    );
  }

  let campaign:
    CampaignForTracking |
    null = null;

  try {
    campaign =
      await findCampaign(
        trackingCode,
      );
  } catch (
    error
  ) {
    console.error(
      "[MARKETING_TRACK_CAMPAIGN_LOOKUP_ERROR]",
      error instanceof Error
        ? {
            name:
              error.name,
            message:
              error.message,
          }
        : error,
    );

    return createRedirectResponse(
      createFallbackUrl(
        request,
      ),
    );
  }

  if (!campaign) {
    return createRedirectResponse(
      createFallbackUrl(
        request,
      ),
    );
  }

  const destination =
    createEventDestinationUrl({
      request,
      campaign,
      trackingCode,
    });

  const response =
    createRedirectResponse(
      destination,
    );

  const existingVisitorToken =
    request.cookies.get(
      VISITOR_COOKIE_NAME,
    )?.value;

  const existingSessionToken =
    request.cookies.get(
      SESSION_COOKIE_NAME,
    )?.value;

  const visitorToken =
    normalizeText(
      existingVisitorToken,
    ) ||
    createOpaqueToken();

  const sessionToken =
    normalizeText(
      existingSessionToken,
    ) ||
    createOpaqueToken();

  setTrackingCookies({
    response,
    visitorToken,
    sessionToken,
  });

  if (
    campaignCanTrack(
      campaign,
      new Date(),
    )
  ) {
    try {
      await recordVisit({
        request,
        campaign,
        destination,
        visitorToken,
        sessionToken,
      });
    } catch (
      error
    ) {
      console.error(
        "[MARKETING_TRACK_VISIT_CREATE_ERROR]",
        error instanceof Error
          ? {
              name:
                error.name,
              message:
                error.message,
            }
          : error,
      );
    }
  }

  return response;
}

export async function GET(
  request:
    NextRequest,
  context:
    RouteContext,
) {
  return handleTrackingRequest(
    request,
    context,
  );
}

export async function HEAD(
  request:
    NextRequest,
  context:
    RouteContext,
) {
  return handleTrackingRequest(
    request,
    context,
  );
}