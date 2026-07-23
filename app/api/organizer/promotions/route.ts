import { NextResponse } from "next/server";

import {
  getOrganizerPromotions,
  GetOrganizerPromotionsError,
  type GetOrganizerPromotionsResult,
} from "@/lib/organizer/promotions/get-organizer-promotions";
import type { OrganizerPromotionsQueryInput } from "@/lib/organizer/promotions/promotion-schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type OrganizerPromotionsApiResponse =
  | {
      success: true;
      message: string;
      data: GetOrganizerPromotionsResult;
    }
  | {
      success: false;
      message: string;
      code: string;
      fields?: Record<string, string[]>;
      redirectTo?: string;
    };

function noStoreHeaders(): HeadersInit {
  return {
    "Cache-Control":
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "X-Content-Type-Options": "nosniff",
  };
}

function jsonResponse(
  body: OrganizerPromotionsApiResponse,
  status: number,
): NextResponse<OrganizerPromotionsApiResponse> {
  return NextResponse.json(body, {
    status,
    headers: noStoreHeaders(),
  });
}

function normalizeOptionalQueryValue(
  value: string | null,
): string | undefined {
  if (value === null) {
    return undefined;
  }

  const normalized = value.trim();

  return normalized.length > 0
    ? normalized
    : undefined;
}

function buildQueryInput(
  request: Request,
): Partial<OrganizerPromotionsQueryInput> {
  const url = new URL(request.url);
  const searchParams = url.searchParams;

  const input: Partial<OrganizerPromotionsQueryInput> =
    {};

  const search =
    normalizeOptionalQueryValue(
      searchParams.get("search") ??
        searchParams.get("q"),
    );

  const subscriptionStatus =
    normalizeOptionalQueryValue(
      searchParams.get(
        "subscriptionStatus",
      ),
    );

  const boostStatus =
    normalizeOptionalQueryValue(
      searchParams.get("boostStatus"),
    );

  const historyType =
    normalizeOptionalQueryValue(
      searchParams.get("historyType"),
    );

  const sort =
    normalizeOptionalQueryValue(
      searchParams.get("sort"),
    );

  const page =
    normalizeOptionalQueryValue(
      searchParams.get("page"),
    );

  const pageSize =
    normalizeOptionalQueryValue(
      searchParams.get("pageSize"),
    );

  const includeHistory =
    normalizeOptionalQueryValue(
      searchParams.get(
        "includeHistory",
      ),
    );

  const includeAvailableEvents =
    normalizeOptionalQueryValue(
      searchParams.get(
        "includeAvailableEvents",
      ),
    );

  const includePlans =
    normalizeOptionalQueryValue(
      searchParams.get("includePlans"),
    );

  if (search !== undefined) {
    input.search = search;
  }

  if (
    subscriptionStatus !== undefined
  ) {
    input.subscriptionStatus =
      subscriptionStatus as OrganizerPromotionsQueryInput["subscriptionStatus"];
  }

  if (boostStatus !== undefined) {
    input.boostStatus =
      boostStatus as OrganizerPromotionsQueryInput["boostStatus"];
  }

  if (historyType !== undefined) {
    input.historyType =
      historyType as OrganizerPromotionsQueryInput["historyType"];
  }

  if (sort !== undefined) {
    input.sort =
      sort as OrganizerPromotionsQueryInput["sort"];
  }

  if (page !== undefined) {
    input.page = page;
  }

  if (pageSize !== undefined) {
    input.pageSize = pageSize;
  }

  if (includeHistory !== undefined) {
    input.includeHistory =
      includeHistory;
  }

  if (
    includeAvailableEvents !== undefined
  ) {
    input.includeAvailableEvents =
      includeAvailableEvents;
  }

  if (includePlans !== undefined) {
    input.includePlans = includePlans;
  }

  return input;
}

export async function GET(
  request: Request,
): Promise<
  NextResponse<OrganizerPromotionsApiResponse>
> {
  try {
    const input =
      buildQueryInput(request);

    const data =
      await getOrganizerPromotions(
        input,
      );

    return jsonResponse(
      {
        success: true,
        message:
          "Les données de la Visibilité Premium ont été chargées avec succès.",
        data,
      },
      200,
    );
  } catch (error) {
    if (
      error instanceof
      GetOrganizerPromotionsError
    ) {
      const logPayload = {
        code: error.code,
        status: error.status,
        message: error.message,
      };

      if (error.status >= 500) {
        console.error(
          "[ORGANIZER_PROMOTIONS_ROUTE_REJECTED]",
          logPayload,
        );
      } else {
        console.warn(
          "[ORGANIZER_PROMOTIONS_ROUTE_REJECTED]",
          logPayload,
        );
      }

      return jsonResponse(
        {
          success: false,
          code: error.code,
          message: error.message,
          fields: error.fields,
          redirectTo:
            error.redirectTo,
        },
        error.status,
      );
    }

    console.error(
      "[ORGANIZER_PROMOTIONS_ROUTE_ERROR]",
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack:
              process.env.NODE_ENV ===
              "development"
                ? error.stack
                : undefined,
          }
        : error,
    );

    return jsonResponse(
      {
        success: false,
        code:
          "GET_ORGANIZER_PROMOTIONS_FAILED",
        message:
          "Impossible de charger la Visibilité Premium pour le moment.",
      },
      500,
    );
  }
}