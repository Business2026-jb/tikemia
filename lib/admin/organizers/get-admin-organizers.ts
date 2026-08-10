import "server-only";

import { EventStatus, Prisma, UserRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type AdminOrganizerStatusFilter =
  | "all"
  | "active"
  | "inactive"
  | "verified"
  | "unverified";

export type AdminOrganizerSort =
  | "newest"
  | "oldest"
  | "name_asc"
  | "name_desc";

export type GetAdminOrganizersInput = {
  search?: string | null;
  status?: AdminOrganizerStatusFilter;
  sort?: AdminOrganizerSort;
  page?: number;
  pageSize?: number;
};

export type AdminOrganizerListItem = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  country: string;
  countryCode: string;
  dialCode: string;
  emailVerified: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  profile: {
    businessName: string | null;
    businessType: string | null;
    logo: string | null;
    avatar: string | null;
    city: string | null;
    hasBlueBadge: boolean;
  } | null;
  counts: {
    events: number;
    publishedEvents: number;
    orders: number;
    tickets: number;
    payouts: number;
  };
};

export type GetAdminOrganizersResult = {
  organizers: AdminOrganizerListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
  summary: {
    total: number;
    active: number;
    inactive: number;
    verified: number;
    unverified: number;
  };
};

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function positiveInteger(
  value: number | undefined,
  fallback: number,
): number {
  return Number.isInteger(value) && Number(value) > 0
    ? Number(value)
    : fallback;
}

function buildWhere(
  search: string,
  status: AdminOrganizerStatusFilter,
): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {
    role: UserRole.ORGANIZER,
  };

  if (status === "active") where.isActive = true;
  if (status === "inactive") where.isActive = false;
  if (status === "verified") where.emailVerified = true;
  if (status === "unverified") where.emailVerified = false;

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
      { country: { contains: search, mode: "insensitive" } },
      {
        organizerProfile: {
          is: {
            businessName: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
      },
      {
        organizerProfile: {
          is: {
            city: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
      },
    ];
  }

  return where;
}

function buildOrderBy(
  sort: AdminOrganizerSort,
): Prisma.UserOrderByWithRelationInput[] {
  switch (sort) {
    case "oldest":
      return [{ createdAt: "asc" }, { id: "asc" }];
    case "name_asc":
      return [
        { firstName: "asc" },
        { lastName: "asc" },
        { id: "asc" },
      ];
    case "name_desc":
      return [
        { firstName: "desc" },
        { lastName: "desc" },
        { id: "desc" },
      ];
    default:
      return [{ createdAt: "desc" }, { id: "desc" }];
  }
}

export async function getAdminOrganizers(
  input: GetAdminOrganizersInput = {},
): Promise<GetAdminOrganizersResult> {
  const search = input.search?.trim() ?? "";
  const status = input.status ?? "all";
  const sort = input.sort ?? "newest";
  const page = positiveInteger(input.page, DEFAULT_PAGE);
  const pageSize = Math.min(
    positiveInteger(input.pageSize, DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );

  const where = buildWhere(search, status);
  const skip = (page - 1) * pageSize;

  const [
    totalItems,
    users,
    total,
    active,
    verified,
  ] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: buildOrderBy(sort),
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        country: true,
        countryCode: true,
        dialCode: true,
        emailVerified: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        organizerProfile: {
          select: {
            businessName: true,
            businessType: true,
            logo: true,
            avatar: true,
            city: true,
            hasBlueBadge: true,
          },
        },
        _count: {
          select: {
            organizerEvents: true,
            organizerPayouts: true,
          },
        },
      },
    }),
    prisma.user.count({
      where: { role: UserRole.ORGANIZER },
    }),
    prisma.user.count({
      where: {
        role: UserRole.ORGANIZER,
        isActive: true,
      },
    }),
    prisma.user.count({
      where: {
        role: UserRole.ORGANIZER,
        emailVerified: true,
      },
    }),
  ]);

  const organizerIds = users.map((user) => user.id);

  const [publishedGroups, orderGroups, ticketGroups] =
    organizerIds.length === 0
      ? [[], [], []]
      : await Promise.all([
          prisma.event.groupBy({
            by: ["organizerId"],
            where: {
              organizerId: { in: organizerIds },
              status: EventStatus.PUBLISHED,
            },
            _count: { _all: true },
          }),
          prisma.order.groupBy({
            by: ["eventId"],
            where: {
              event: {
                organizerId: { in: organizerIds },
              },
            },
            _count: { _all: true },
          }),
          prisma.ticket.groupBy({
            by: ["eventId"],
            where: {
              event: {
                organizerId: { in: organizerIds },
              },
            },
            _count: { _all: true },
          }),
        ]);

  const events = organizerIds.length
    ? await prisma.event.findMany({
        where: { organizerId: { in: organizerIds } },
        select: { id: true, organizerId: true },
      })
    : [];

  const eventOwner = new Map(
    events.map((event) => [event.id, event.organizerId]),
  );

  const publishedByOrganizer = new Map(
    publishedGroups.map((group) => [
      group.organizerId,
      group._count._all,
    ]),
  );

  const ordersByOrganizer = new Map<string, number>();
  for (const group of orderGroups) {
    const owner = eventOwner.get(group.eventId);
    if (!owner) continue;
    ordersByOrganizer.set(
      owner,
      (ordersByOrganizer.get(owner) ?? 0) + group._count._all,
    );
  }

  const ticketsByOrganizer = new Map<string, number>();
  for (const group of ticketGroups) {
    const owner = eventOwner.get(group.eventId);
    if (!owner) continue;
    ticketsByOrganizer.set(
      owner,
      (ticketsByOrganizer.get(owner) ?? 0) + group._count._all,
    );
  }

  const totalPages =
    totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);

  return {
    organizers: users.map((user) => ({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      phone: user.phone,
      country: user.country,
      countryCode: user.countryCode,
      dialCode: user.dialCode,
      emailVerified: user.emailVerified,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      profile: user.organizerProfile,
      counts: {
        events: user._count.organizerEvents,
        publishedEvents:
          publishedByOrganizer.get(user.id) ?? 0,
        orders: ordersByOrganizer.get(user.id) ?? 0,
        tickets: ticketsByOrganizer.get(user.id) ?? 0,
        payouts: user._count.organizerPayouts,
      },
    })),
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
      hasPreviousPage: page > 1,
      hasNextPage: page < totalPages,
    },
    summary: {
      total,
      active,
      inactive: Math.max(total - active, 0),
      verified,
      unverified: Math.max(total - verified, 0),
    },
  };
}
