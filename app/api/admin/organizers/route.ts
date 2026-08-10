import { EventStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import {
  getAdminOrganizers,
  type AdminOrganizerSort,
  type AdminOrganizerStatusFilter,
} from "@/lib/admin/organizers/get-admin-organizers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_STATUS = new Set<AdminOrganizerStatusFilter>([
  "all",
  "active",
  "inactive",
  "verified",
  "unverified",
]);

const ALLOWED_SORT = new Set<AdminOrganizerSort>([
  "newest",
  "oldest",
  "name_asc",
  "name_desc",
]);

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const search = searchParams.get("search")?.trim() ?? "";
    const rawStatus = searchParams.get("status") ?? "all";
    const rawSort = searchParams.get("sort") ?? "newest";

    const status: AdminOrganizerStatusFilter =
      ALLOWED_STATUS.has(rawStatus as AdminOrganizerStatusFilter)
        ? (rawStatus as AdminOrganizerStatusFilter)
        : "all";

    const sort: AdminOrganizerSort =
      ALLOWED_SORT.has(rawSort as AdminOrganizerSort)
        ? (rawSort as AdminOrganizerSort)
        : "newest";

    const page = parsePositiveInteger(
      searchParams.get("page"),
      1,
    );

    const pageSize = Math.min(
      parsePositiveInteger(searchParams.get("pageSize"), 20),
      100,
    );

    const result = await getAdminOrganizers({
      search,
      status,
      sort,
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
    console.error("[ADMIN_ORGANIZERS_GET]", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to load organizers.",
      },
      { status: 500 },
    );
  }
}
