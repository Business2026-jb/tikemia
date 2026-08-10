import { NextRequest, NextResponse } from "next/server";

import {
  deleteOrganizer,
  DeleteOrganizerError,
} from "@/lib/admin/organizers/delete-organizer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    organizerId: string;
  }>;
};

type DeleteBody = {
  confirmationEmail?: unknown;
  permanent?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

export async function DELETE(
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

    let rawBody: unknown;

    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "A valid JSON body is required.",
        },
        { status: 400 },
      );
    }

    if (!isRecord(rawBody)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request body.",
        },
        { status: 400 },
      );
    }

    const body = rawBody as DeleteBody;

    if (
      typeof body.confirmationEmail !== "string" ||
      !body.confirmationEmail.trim()
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Confirmation email is required.",
        },
        { status: 400 },
      );
    }

    if (
      body.permanent !== undefined &&
      typeof body.permanent !== "boolean"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "The permanent field must be a boolean.",
        },
        { status: 400 },
      );
    }

    const result = await deleteOrganizer({
      organizerId,
      confirmationEmail: body.confirmationEmail,
      permanent: body.permanent === true,
    });

    return NextResponse.json(
      {
        success: true,
        data: result,
        message:
          result.action === "DELETED"
            ? "Organizer permanently deleted."
            : "Organizer deactivated successfully.",
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    if (error instanceof DeleteOrganizerError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
          details: error.details ?? null,
        },
        { status: error.status },
      );
    }

    console.error("[ADMIN_ORGANIZER_DELETE]", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to delete organizer.",
      },
      { status: 500 },
    );
  }
}
