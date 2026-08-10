import { NextRequest, NextResponse } from "next/server";

import {
  AdminOrganizerNotFoundError,
  getAdminOrganizer,
} from "@/lib/admin/organizers/get-admin-organizer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    organizerId: string;
  }>;
};

export async function GET(
  _request: NextRequest,
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

    const organizer = await getAdminOrganizer(organizerId);

    return NextResponse.json(
      {
        success: true,
        data: organizer,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    if (error instanceof AdminOrganizerNotFoundError) {
      return NextResponse.json(
        {
          success: false,
          error: "Organizer not found.",
        },
        { status: 404 },
      );
    }

    console.error("[ADMIN_ORGANIZER_GET]", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to load organizer.",
      },
      { status: 500 },
    );
  }
}
