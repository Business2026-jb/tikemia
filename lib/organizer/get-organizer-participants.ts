import "server-only";

import {
  Prisma,
  TicketStatus,
  type EventStatus,
  type OrderStatus,
  type PaymentStatus,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export const ORGANIZER_PARTICIPANTS_SORTS = [
  "NEWEST",
  "OLDEST",
  "NAME_ASC",
  "NAME_DESC",
  "EVENT_DATE_ASC",
  "EVENT_DATE_DESC",
  "CHECKED_IN_FIRST",
] as const;

export type OrganizerParticipantsSort =
  (typeof ORGANIZER_PARTICIPANTS_SORTS)[number];

export type GetOrganizerParticipantsParams = {
  organizerId: string;
  page?: number;
  pageSize?: number;
  search?: string | null;
  eventId?: string | null;
  ticketTypeId?: string | null;
  status?: string | null;
  attendance?: string | null;
  country?: string | null;
  dateFrom?: string | Date | null;
  dateTo?: string | Date | null;
  sort?: OrganizerParticipantsSort;
};

export type OrganizerParticipantListItem = {
  id: string;
  code: string;
  qrCodeValue: string;
  status: TicketStatus;
  holder: {
    name: string;
    email: string;
    phone: string | null;
    country: string | null;
    countryCode: string | null;
  };
  customerAccount: {
    id: string;
    name: string;
    email: string;
    phone: string;
    country: string;
    countryCode: string;
    emailVerified: boolean;
    isActive: boolean;
  } | null;
  isGuestPurchase: boolean;
  event: {
    id: string;
    title: string;
    slug: string;
    coverImage: string | null;
    venueName: string;
    city: string;
    country: string;
    countryCode: string;
    timezone: string;
    startsAt: string;
    endsAt: string | null;
    status: EventStatus;
  };
  ticketType: {
    id: string;
    name: string;
    description: string | null;
  };
  order: {
    id: string;
    reference: string;
    status: OrderStatus;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    currency: string;
    paidAt: string | null;
    createdAt: string;
    payment: {
      id: string;
      provider: string;
      providerReference: string | null;
      method: string;
      status: PaymentStatus;
      paidAt: string | null;
    } | null;
  };
  checkedIn: boolean;
  usedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrganizerParticipantsSummary = {
  totalTickets: number;
  expectedParticipants: number;
  checkedInParticipants: number;
  notCheckedInParticipants: number;
  cancelledTickets: number;
  refundedTickets: number;
  uniqueParticipants: number;
  guestParticipants: number;
  registeredParticipants: number;
  attendanceRate: number;
};

export type OrganizerParticipantEventOption = {
  id: string;
  title: string;
  status: EventStatus;
  startsAt: string;
  coverImage: string | null;
  city: string;
  country: string;
};

export type OrganizerParticipantTicketTypeOption = {
  id: string;
  name: string;
  eventId: string;
  eventTitle: string;
};

export type OrganizerParticipantCountryOption = {
  name: string;
  code: string | null;
};

export type OrganizerParticipantsAppliedFilters = {
  search: string;
  eventId: string | null;
  ticketTypeId: string | null;
  status: TicketStatus | null;
  attendance: "CHECKED_IN" | "NOT_CHECKED_IN" | null;
  country: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  sort: OrganizerParticipantsSort;
};

export type GetOrganizerParticipantsResult = {
  generatedAt: string;
  participants: OrganizerParticipantListItem[];
  summary: OrganizerParticipantsSummary;
  options: {
    events: OrganizerParticipantEventOption[];
    ticketTypes: OrganizerParticipantTicketTypeOption[];
    countries: OrganizerParticipantCountryOption[];
    statuses: TicketStatus[];
    sorts: OrganizerParticipantsSort[];
  };
  appliedFilters: OrganizerParticipantsAppliedFilters;
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
};

export class GetOrganizerParticipantsError extends Error {
  readonly code: string;
  readonly status: number;

  constructor({
    code,
    message,
    status = 500,
  }: {
    code: string;
    message: string;
    status?: number;
  }) {
    super(message);
    this.name = "GetOrganizerParticipantsError";
    this.code = code;
    this.status = status;
  }
}

function normalizeInteger(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(value), minimum), maximum);
}

function normalizeText(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  const normalized = normalizeText(value);
  return normalized || null;
}

function normalizeTicketStatus(
  value: string | null | undefined,
): TicketStatus | null {
  const normalized = normalizeText(value).toUpperCase();

  return Object.values(TicketStatus).includes(normalized as TicketStatus)
    ? (normalized as TicketStatus)
    : null;
}

function normalizeAttendance(
  value: string | null | undefined,
): "CHECKED_IN" | "NOT_CHECKED_IN" | null {
  const normalized = normalizeText(value).toUpperCase();

  if (
    normalized === "CHECKED_IN" ||
    normalized === "PRESENT" ||
    normalized === "USED"
  ) {
    return "CHECKED_IN";
  }

  if (
    normalized === "NOT_CHECKED_IN" ||
    normalized === "ABSENT" ||
    normalized === "EXPECTED"
  ) {
    return "NOT_CHECKED_IN";
  }

  return null;
}

function normalizeSort(
  value: OrganizerParticipantsSort | undefined,
): OrganizerParticipantsSort {
  return value && ORGANIZER_PARTICIPANTS_SORTS.includes(value)
    ? value
    : "NEWEST";
}

function parseDate(
  value: string | Date | null | undefined,
  endOfDay = false,
): Date | null {
  if (!value) {
    return null;
  }

  const parsed =
    value instanceof Date ? new Date(value.getTime()) : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  if (
    endOfDay &&
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    parsed.setHours(23, 59, 59, 999);
  }

  return parsed;
}

function buildWhere({
  organizerId,
  search,
  eventId,
  ticketTypeId,
  status,
  attendance,
  country,
  dateFrom,
  dateTo,
}: {
  organizerId: string;
  search: string;
  eventId: string | null;
  ticketTypeId: string | null;
  status: TicketStatus | null;
  attendance: "CHECKED_IN" | "NOT_CHECKED_IN" | null;
  country: string | null;
  dateFrom: Date | null;
  dateTo: Date | null;
}): Prisma.TicketWhereInput {
  const andConditions: Prisma.TicketWhereInput[] = [
    {
      event: {
        organizerId,
      },
    },
  ];

  if (eventId) {
    andConditions.push({ eventId });
  }

  if (ticketTypeId) {
    andConditions.push({ ticketTypeId });
  }

  if (status) {
    andConditions.push({ status });
  }

  if (attendance === "CHECKED_IN") {
    andConditions.push({
      status: TicketStatus.USED,
      usedAt: { not: null },
    });
  }

  if (attendance === "NOT_CHECKED_IN") {
    andConditions.push({
      status: TicketStatus.VALID,
      usedAt: null,
    });
  }

  if (country) {
    andConditions.push({
      order: {
        customer: {
          is: {
            country: {
              equals: country,
              mode: "insensitive",
            },
          },
        },
      },
    });
  }

  if (dateFrom || dateTo) {
    andConditions.push({
      createdAt: {
        ...(dateFrom ? { gte: dateFrom } : {}),
        ...(dateTo ? { lte: dateTo } : {}),
      },
    });
  }

  if (search) {
    andConditions.push({
      OR: [
        { code: { contains: search, mode: "insensitive" } },
        { holderName: { contains: search, mode: "insensitive" } },
        { holderEmail: { contains: search, mode: "insensitive" } },
        { holderPhone: { contains: search, mode: "insensitive" } },
        {
          event: {
            title: { contains: search, mode: "insensitive" },
          },
        },
        {
          ticketType: {
            name: { contains: search, mode: "insensitive" },
          },
        },
        {
          order: {
            reference: { contains: search, mode: "insensitive" },
          },
        },
        {
          order: {
            customerName: { contains: search, mode: "insensitive" },
          },
        },
        {
          order: {
            customerEmail: { contains: search, mode: "insensitive" },
          },
        },
        {
          order: {
            customerPhone: { contains: search, mode: "insensitive" },
          },
        },
      ],
    });
  }

  return { AND: andConditions };
}

function buildOrderBy(
  sort: OrganizerParticipantsSort,
): Prisma.TicketOrderByWithRelationInput[] {
  switch (sort) {
    case "OLDEST":
      return [{ createdAt: "asc" }, { id: "asc" }];

    case "NAME_ASC":
      return [{ holderName: "asc" }, { createdAt: "desc" }];

    case "NAME_DESC":
      return [{ holderName: "desc" }, { createdAt: "desc" }];

    case "EVENT_DATE_ASC":
      return [{ event: { startsAt: "asc" } }, { holderName: "asc" }];

    case "EVENT_DATE_DESC":
      return [{ event: { startsAt: "desc" } }, { holderName: "asc" }];

    case "CHECKED_IN_FIRST":
      return [
        { usedAt: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ];

    case "NEWEST":
    default:
      return [{ createdAt: "desc" }, { id: "desc" }];
  }
}

function calculateAttendanceRate({
  checkedIn,
  expected,
}: {
  checkedIn: number;
  expected: number;
}): number {
  const eligible = checkedIn + expected;

  if (eligible <= 0) {
    return 0;
  }

  return Math.round((checkedIn / eligible) * 10_000) / 100;
}

export async function getOrganizerParticipants({
  organizerId,
  page = DEFAULT_PAGE,
  pageSize = DEFAULT_PAGE_SIZE,
  search,
  eventId,
  ticketTypeId,
  status,
  attendance,
  country,
  dateFrom,
  dateTo,
  sort = "NEWEST",
}: GetOrganizerParticipantsParams): Promise<GetOrganizerParticipantsResult> {
  const cleanOrganizerId = organizerId.trim();

  if (!cleanOrganizerId) {
    throw new GetOrganizerParticipantsError({
      code: "ORGANIZER_ID_REQUIRED",
      status: 400,
      message: "L’identifiant de l’organisateur est obligatoire.",
    });
  }

  const normalizedPage = normalizeInteger(
    page,
    DEFAULT_PAGE,
    1,
    1_000_000,
  );

  const normalizedPageSize = normalizeInteger(
    pageSize,
    DEFAULT_PAGE_SIZE,
    1,
    MAX_PAGE_SIZE,
  );

  const normalizedSearch = normalizeText(search);
  const normalizedEventId = normalizeOptionalText(eventId);
  const normalizedTicketTypeId = normalizeOptionalText(ticketTypeId);
  const normalizedStatus = normalizeTicketStatus(status);
  const normalizedAttendance = normalizeAttendance(attendance);
  const normalizedCountry = normalizeOptionalText(country);
  const normalizedDateFrom = parseDate(dateFrom);
  const normalizedDateTo = parseDate(dateTo, true);
  const normalizedSort = normalizeSort(sort);

  if (
    normalizedDateFrom &&
    normalizedDateTo &&
    normalizedDateFrom.getTime() > normalizedDateTo.getTime()
  ) {
    throw new GetOrganizerParticipantsError({
      code: "INVALID_DATE_RANGE",
      status: 422,
      message:
        "La date de début ne peut pas être postérieure à la date de fin.",
    });
  }

  const where = buildWhere({
    organizerId: cleanOrganizerId,
    search: normalizedSearch,
    eventId: normalizedEventId,
    ticketTypeId: normalizedTicketTypeId,
    status: normalizedStatus,
    attendance: normalizedAttendance,
    country: normalizedCountry,
    dateFrom: normalizedDateFrom,
    dateTo: normalizedDateTo,
  });

  try {
    const organizer = await prisma.user.findFirst({
      where: {
        id: cleanOrganizerId,
        role: "ORGANIZER",
      },
      select: {
        id: true,
        isActive: true,
        emailVerified: true,
      },
    });

    if (!organizer) {
      throw new GetOrganizerParticipantsError({
        code: "ORGANIZER_NOT_FOUND",
        status: 404,
        message: "Le compte organisateur est introuvable.",
      });
    }

    if (!organizer.isActive || !organizer.emailVerified) {
      throw new GetOrganizerParticipantsError({
        code: "ORGANIZER_FORBIDDEN",
        status: 403,
        message:
          "Ce compte organisateur ne peut pas consulter les participants.",
      });
    }

    const [
      totalItems,
      tickets,
      validTickets,
      usedTickets,
      cancelledTickets,
      refundedTickets,
      uniqueEmailRows,
      guestParticipants,
      events,
      ticketTypes,
      customerCountries,
    ] = await prisma.$transaction([
      prisma.ticket.count({
        where,
      }),

      prisma.ticket.findMany({
        where,
        orderBy: buildOrderBy(normalizedSort),
        skip: (normalizedPage - 1) * normalizedPageSize,
        take: normalizedPageSize,
        select: {
          id: true,
          code: true,
          qrCodeValue: true,
          holderName: true,
          holderEmail: true,
          holderPhone: true,
          status: true,
          usedAt: true,
          createdAt: true,
          updatedAt: true,
          event: {
            select: {
              id: true,
              title: true,
              slug: true,
              coverImage: true,
              venueName: true,
              city: true,
              country: true,
              countryCode: true,
              timezone: true,
              startsAt: true,
              endsAt: true,
              status: true,
            },
          },
          ticketType: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          order: {
            select: {
              id: true,
              reference: true,
              status: true,
              customerId: true,
              customerName: true,
              customerEmail: true,
              customerPhone: true,
              currency: true,
              paidAt: true,
              createdAt: true,
              customer: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true,
                  country: true,
                  countryCode: true,
                  emailVerified: true,
                  isActive: true,
                },
              },
              payment: {
                select: {
                  id: true,
                  provider: true,
                  providerReference: true,
                  method: true,
                  status: true,
                  paidAt: true,
                },
              },
            },
          },
        },
      }),

      prisma.ticket.count({
        where: {
          AND: [
            where,
            {
              status: TicketStatus.VALID,
            },
          ],
        },
      }),

      prisma.ticket.count({
        where: {
          AND: [
            where,
            {
              status: TicketStatus.USED,
            },
          ],
        },
      }),

      prisma.ticket.count({
        where: {
          AND: [
            where,
            {
              status: TicketStatus.CANCELLED,
            },
          ],
        },
      }),

      prisma.ticket.count({
        where: {
          AND: [
            where,
            {
              status: TicketStatus.REFUNDED,
            },
          ],
        },
      }),

      prisma.ticket.findMany({
        where: {
          AND: [
            where,
            {
              holderEmail: {
                not: "",
              },
            },
          ],
        },
        distinct: ["holderEmail"],
        select: {
          holderEmail: true,
        },
      }),

      prisma.ticket.count({
        where: {
          AND: [
            where,
            {
              order: {
                customerId: null,
              },
            },
          ],
        },
      }),

      prisma.event.findMany({
        where: {
          organizerId: cleanOrganizerId,
        },
        orderBy: [
          {
            startsAt: "desc",
          },
          {
            title: "asc",
          },
        ],
        select: {
          id: true,
          title: true,
          status: true,
          startsAt: true,
          coverImage: true,
          city: true,
          country: true,
        },
      }),

      prisma.ticketType.findMany({
        where: {
          event: {
            organizerId: cleanOrganizerId,
          },
        },
        orderBy: [
          {
            event: {
              title: "asc",
            },
          },
          {
            name: "asc",
          },
        ],
        select: {
          id: true,
          name: true,
          eventId: true,
          event: {
            select: {
              title: true,
            },
          },
        },
      }),

      prisma.user.findMany({
        where: {
          customerOrders: {
            some: {
              event: {
                organizerId: cleanOrganizerId,
              },
            },
          },
        },
        distinct: ["country", "countryCode"],
        orderBy: [
          {
            country: "asc",
          },
          {
            countryCode: "asc",
          },
        ],
        select: {
          country: true,
          countryCode: true,
        },
      }),
    ]);

    const uniqueParticipants = uniqueEmailRows.length;

    const totalPages = Math.max(
      Math.ceil(totalItems / normalizedPageSize),
      1,
    );

    const safePage = Math.min(normalizedPage, totalPages);

    return {
      generatedAt: new Date().toISOString(),

      participants: tickets.map((ticket) => {
        const customer = ticket.order.customer;
        const customerName = customer
          ? `${customer.firstName} ${customer.lastName}`
              .replace(/\s+/g, " ")
              .trim()
          : "";

        return {
          id: ticket.id,
          code: ticket.code,
          qrCodeValue: ticket.qrCodeValue,
          status: ticket.status,
          holder: {
            name: normalizeText(ticket.holderName) || "Participant Tikemia",
            email: normalizeText(ticket.holderEmail),
            phone: normalizeOptionalText(ticket.holderPhone),
            country: customer?.country ?? null,
            countryCode: customer?.countryCode ?? null,
          },
          customerAccount: customer
            ? {
                id: customer.id,
                name: customerName || "Client Tikemia",
                email: customer.email,
                phone: customer.phone,
                country: customer.country,
                countryCode: customer.countryCode,
                emailVerified: customer.emailVerified,
                isActive: customer.isActive,
              }
            : null,
          isGuestPurchase: !ticket.order.customerId,
          event: {
            id: ticket.event.id,
            title: ticket.event.title,
            slug: ticket.event.slug,
            coverImage: ticket.event.coverImage,
            venueName: ticket.event.venueName,
            city: ticket.event.city,
            country: ticket.event.country,
            countryCode: ticket.event.countryCode,
            timezone: ticket.event.timezone,
            startsAt: ticket.event.startsAt.toISOString(),
            endsAt: ticket.event.endsAt?.toISOString() ?? null,
            status: ticket.event.status,
          },
          ticketType: {
            id: ticket.ticketType.id,
            name: ticket.ticketType.name,
            description: ticket.ticketType.description,
          },
          order: {
            id: ticket.order.id,
            reference: ticket.order.reference,
            status: ticket.order.status,
            customerName: ticket.order.customerName,
            customerEmail: ticket.order.customerEmail,
            customerPhone: ticket.order.customerPhone,
            currency: ticket.order.currency,
            paidAt: ticket.order.paidAt?.toISOString() ?? null,
            createdAt: ticket.order.createdAt.toISOString(),
            payment: ticket.order.payment
              ? {
                  id: ticket.order.payment.id,
                  provider: ticket.order.payment.provider,
                  providerReference:
                    ticket.order.payment.providerReference,
                  method: ticket.order.payment.method,
                  status: ticket.order.payment.status,
                  paidAt:
                    ticket.order.payment.paidAt?.toISOString() ?? null,
                }
              : null,
          },
          checkedIn:
            ticket.status === TicketStatus.USED || ticket.usedAt !== null,
          usedAt: ticket.usedAt?.toISOString() ?? null,
          createdAt: ticket.createdAt.toISOString(),
          updatedAt: ticket.updatedAt.toISOString(),
        } satisfies OrganizerParticipantListItem;
      }),

      summary: {
        totalTickets: totalItems,
        expectedParticipants: validTickets,
        checkedInParticipants: usedTickets,
        notCheckedInParticipants: validTickets,
        cancelledTickets,
        refundedTickets,
        uniqueParticipants,
        guestParticipants,
        registeredParticipants: Math.max(
          totalItems - guestParticipants,
          0,
        ),
        attendanceRate: calculateAttendanceRate({
          checkedIn: usedTickets,
          expected: validTickets,
        }),
      },

      options: {
        events: events.map((event) => ({
          id: event.id,
          title: event.title,
          status: event.status,
          startsAt: event.startsAt.toISOString(),
          coverImage: event.coverImage,
          city: event.city,
          country: event.country,
        })),
        ticketTypes: ticketTypes.map((ticketType) => ({
          id: ticketType.id,
          name: ticketType.name,
          eventId: ticketType.eventId,
          eventTitle: ticketType.event.title,
        })),
        countries: customerCountries.map((country) => ({
          name: country.country,
          code: country.countryCode || null,
        })),
        statuses: Object.values(TicketStatus),
        sorts: [...ORGANIZER_PARTICIPANTS_SORTS],
      },

      appliedFilters: {
        search: normalizedSearch,
        eventId: normalizedEventId,
        ticketTypeId: normalizedTicketTypeId,
        status: normalizedStatus,
        attendance: normalizedAttendance,
        country: normalizedCountry,
        dateFrom: normalizedDateFrom?.toISOString() ?? null,
        dateTo: normalizedDateTo?.toISOString() ?? null,
        sort: normalizedSort,
      },

      pagination: {
        page: safePage,
        pageSize: normalizedPageSize,
        totalItems,
        totalPages,
        hasPreviousPage: safePage > 1,
        hasNextPage: safePage < totalPages,
      },
    };
  } catch (error) {
    if (error instanceof GetOrganizerParticipantsError) {
      throw error;
    }

    console.error(
      "[GET_ORGANIZER_PARTICIPANTS_ERROR]",
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack:
              process.env.NODE_ENV === "development"
                ? error.stack
                : undefined,
          }
        : error,
    );

    throw new GetOrganizerParticipantsError({
      code: "GET_ORGANIZER_PARTICIPANTS_FAILED",
      status: 500,
      message:
        "Impossible de charger les participants pour le moment.",
    });
  }
}