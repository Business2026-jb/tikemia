import { EventStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { getOrganizerEvents } from "@/lib/admin/organizers/get-organizer-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    organizerId: string;
  }>;
};

const EVENT_STATUSES = new Set<string>(
  Object.values(EventStatus),
);

function parsePositiveInteger(
  value: string | null,
  fallback: number,
): number {
  if (!value) return fallback;

  const parsed = Number.parseInt(value, 10);

  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : fallback;
}

export async function GET(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const { organizerId } = await context.params;

    if (!organizerId?.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Organizer id is required.",
        },
        { status: 400 },
      );
    }

    const { searchParams } = request.nextUrl;

    const search = searchParams.get("search")?.trim() ?? "";
    const rawStatus = searchParams.get("status") ?? "all";

    if (
      rawStatus !== "all" &&
      !EVENT_STATUSES.has(rawStatus)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid event status.",
        },
        { status: 400 },
      );
    }

    const status =
      rawStatus === "all"
        ? "all"
        : (rawStatus as EventStatus);

    const page = parsePositiveInteger(
      searchParams.get("page"),
      1,
    );

    const pageSize = Math.min(
      parsePositiveInteger(searchParams.get("pageSize"), 12),
      50,
    );

    const result = await getOrganizerEvents({
      organizerId,
      search,
      status,
      page,
      pageSize,
    });

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Organizer not found."
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Organizer not found.",
        },
        { status: 404 },
      );
    }

    console.error("[ADMIN_ORGANIZER_EVENTS_GET]", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to load organizer events.",
      },
      { status: 500 },
    );
  }
}
