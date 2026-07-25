import "server-only";

import {
  EventStatus,
  OrderStatus,
  Prisma,
  TicketStatus,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

const DEFAULT_CURRENCY = "XOF";
const MAX_SLUG_LENGTH = 180;

export type ClientEventDetailImage = {
  id: string;
  publicUrl: string;
  isCover: boolean;
  position: number;
};

export type ClientEventDetailCategory = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
};

export type ClientEventDetailOrganizer = {
  id: string;
  name: string;
  businessName: string | null;
  displayName: string;
  logo: string | null;
  avatar: string | null;
  description: string | null;
  businessType: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  facebook: string | null;
  instagram: string | null;
  x: string | null;
  linkedin: string | null;
  hasBlueBadge: boolean;
  publishedEventsCount: number;
  soldTicketsCount: number;
  paidOrdersCount: number;
};

export type ClientEventDetailTicketTypeSaleStatus =
  | "AVAILABLE"
  | "NOT_STARTED"
  | "ENDED"
  | "SOLD_OUT"
  | "INACTIVE";

export type ClientEventDetailTicketType = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  quantity: number;
  soldTickets: number;
  availableTickets: number;
  maxPerOrder: number;
  saleStartsAt: string | null;
  saleEndsAt: string | null;
  isActive: boolean;
  saleStatus: ClientEventDetailTicketTypeSaleStatus;
  canPurchase: boolean;
};

export type ClientEventDetailAvailability = {
  capacity: number;
  soldTickets: number;
  availableTickets: number;
  soldOut: boolean;
};

export type ClientEventDetailSales = {
  startsAt: string | null;
  endsAt: string | null;
  hasStarted: boolean;
  hasEnded: boolean;
  isOpen: boolean;
  status:
    | "OPEN"
    | "NOT_STARTED"
    | "ENDED"
    | "SOLD_OUT"
    | "UNAVAILABLE";
};

export type ClientEventDetailPrice = {
  minimum: number;
  maximum: number;
  currency: string;
  isFree: boolean;
};

export type ClientEventDetail = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  description: string;
  coverImage: string | null;
  images: ClientEventDetailImage[];
  venueName: string;
  address: string;
  city: string;
  country: string;
  countryCode: string;
  timezone: string;
  latitude: number | null;
  longitude: number | null;
  startsAt: string;
  endsAt: string | null;
  salesStartAt: string | null;
  salesEndAt: string | null;
  currency: string;
  platformFeeRate: number;
  isFree: boolean;
  isFeatured: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  category: ClientEventDetailCategory | null;
  organizer: ClientEventDetailOrganizer;
  ticketTypes: ClientEventDetailTicketType[];
  availability: ClientEventDetailAvailability;
  sales: ClientEventDetailSales;
  price: ClientEventDetailPrice;
  paidOrdersCount: number;
  soldTicketsCount: number;
};

export type GetClientEventDetailInput = {
  slug: string;
  now?: Date;
};

export type GetClientEventDetailResult = {
  generatedAt: string;
  event: ClientEventDetail;
};

export class GetClientEventDetailError extends Error {
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
    this.name = "GetClientEventDetailError";
    this.code = code;
    this.status = status;
  }
}

const publicEventDetailSelect = {
  id: true,
  organizerId: true,
  title: true,
  slug: true,
  description: true,
  shortDescription: true,
  coverImage: true,
  venueName: true,
  address: true,
  city: true,
  country: true,
  countryCode: true,
  timezone: true,
  latitude: true,
  longitude: true,
  startsAt: true,
  endsAt: true,
  salesStartAt: true,
  salesEndAt: true,
  currency: true,
  platformFeeRate: true,
  capacity: true,
  status: true,
  isFree: true,
  isFeatured: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
      icon: true,
      description: true,
      isActive: true,
    },
  },
  organizer: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      isActive: true,
      organizerProfile: {
        select: {
          businessName: true,
          businessType: true,
          description: true,
          logo: true,
          avatar: true,
          website: true,
          address: true,
          city: true,
          facebook: true,
          instagram: true,
          x: true,
          linkedin: true,
          hasBlueBadge: true,
        },
      },
    },
  },
  images: {
    orderBy: [
      { isCover: "desc" as const },
      { position: "asc" as const },
    ],
    select: {
      id: true,
      publicUrl: true,
      isCover: true,
      position: true,
    },
  },
  ticketTypes: {
    orderBy: [
      { price: "asc" as const },
      { createdAt: "asc" as const },
    ],
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      quantity: true,
      maxPerOrder: true,
      saleStartsAt: true,
      saleEndsAt: true,
      isActive: true,
      tickets: {
        where: {
          status: {
            in: [TicketStatus.VALID, TicketStatus.USED],
          },
        },
        select: {
          id: true,
        },
      },
    },
  },
  orders: {
    where: {
      status: OrderStatus.PAID,
    },
    select: {
      id: true,
    },
  },
} satisfies Prisma.EventSelect;

type SelectedPublicEvent =
  Prisma.EventGetPayload<{
    select: typeof publicEventDetailSelect;
  }>;

function normalizeSlug(value: string): string {
  const slug = value.trim().toLowerCase().slice(0, MAX_SLUG_LENGTH);

  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new GetClientEventDetailError({
      code: "INVALID_EVENT_SLUG",
      status: 400,
      message: "Le lien de cet événement n’est pas valide.",
    });
  }

  return slug;
}

function toNumber(
  value: Prisma.Decimal | number | null | undefined,
): number {
  if (value === null || value === undefined) {
    return 0;
  }

  const numberValue =
    typeof value === "number" ? value : value.toNumber();

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function toIsoString(
  value: Date | null | undefined,
): string | null {
  return value ? value.toISOString() : null;
}

function getOrganizerName(
  event: SelectedPublicEvent,
): {
  name: string;
  businessName: string | null;
  displayName: string;
} {
  const name =
    `${event.organizer.firstName} ${event.organizer.lastName}`
      .replace(/\s+/g, " ")
      .trim() || "Organisateur Tikemia";

  const businessName =
    event.organizer.organizerProfile?.businessName?.trim() || null;

  return {
    name,
    businessName,
    displayName: businessName || name,
  };
}

function getTicketTypeSaleStatus({
  isActive,
  soldTickets,
  quantity,
  saleStartsAt,
  saleEndsAt,
  eventSalesStartAt,
  eventSalesEndAt,
  now,
}: {
  isActive: boolean;
  soldTickets: number;
  quantity: number;
  saleStartsAt: Date | null;
  saleEndsAt: Date | null;
  eventSalesStartAt: Date | null;
  eventSalesEndAt: Date | null;
  now: Date;
}): ClientEventDetailTicketTypeSaleStatus {
  if (!isActive) {
    return "INACTIVE";
  }

  if (quantity <= soldTickets) {
    return "SOLD_OUT";
  }

  const effectiveSaleStartsAt = saleStartsAt ?? eventSalesStartAt;
  const effectiveSaleEndsAt = saleEndsAt ?? eventSalesEndAt;

  if (effectiveSaleStartsAt && effectiveSaleStartsAt > now) {
    return "NOT_STARTED";
  }

  if (effectiveSaleEndsAt && effectiveSaleEndsAt < now) {
    return "ENDED";
  }

  return "AVAILABLE";
}

function mapTicketTypes({
  event,
  now,
}: {
  event: SelectedPublicEvent;
  now: Date;
}): ClientEventDetailTicketType[] {
  return event.ticketTypes.map((ticketType) => {
    const quantity = Math.max(ticketType.quantity, 0);
    const soldTickets = ticketType.tickets.length;
    const availableTickets = Math.max(quantity - soldTickets, 0);

    const saleStatus = getTicketTypeSaleStatus({
      isActive: ticketType.isActive,
      soldTickets,
      quantity,
      saleStartsAt: ticketType.saleStartsAt,
      saleEndsAt: ticketType.saleEndsAt,
      eventSalesStartAt: event.salesStartAt,
      eventSalesEndAt: event.salesEndAt,
      now,
    });

    return {
      id: ticketType.id,
      name: ticketType.name.trim() || "Billet",
      description: ticketType.description?.trim() || null,
      price: toNumber(ticketType.price),
      currency: event.currency || DEFAULT_CURRENCY,
      quantity,
      soldTickets,
      availableTickets,
      maxPerOrder: Math.max(ticketType.maxPerOrder, 1),
      saleStartsAt: toIsoString(ticketType.saleStartsAt),
      saleEndsAt: toIsoString(ticketType.saleEndsAt),
      isActive: ticketType.isActive,
      saleStatus,
      canPurchase: saleStatus === "AVAILABLE",
    };
  });
}

function getEventPrice({
  event,
  ticketTypes,
}: {
  event: SelectedPublicEvent;
  ticketTypes: ClientEventDetailTicketType[];
}): ClientEventDetailPrice {
  const activeTicketTypes = ticketTypes.filter(
    (ticketType) => ticketType.isActive,
  );

  const prices = activeTicketTypes.map(
    (ticketType) => ticketType.price,
  );

  const minimum = prices.length > 0 ? Math.min(...prices) : 0;
  const maximum = prices.length > 0 ? Math.max(...prices) : 0;

  const isFree =
    event.isFree ||
    (prices.length > 0 && prices.every((price) => price === 0));

  return {
    minimum,
    maximum,
    currency: event.currency || DEFAULT_CURRENCY,
    isFree,
  };
}

function getEventSales({
  event,
  now,
  soldOut,
  hasPurchasableTicketType,
}: {
  event: SelectedPublicEvent;
  now: Date;
  soldOut: boolean;
  hasPurchasableTicketType: boolean;
}): ClientEventDetailSales {
  const hasStarted = !event.salesStartAt || event.salesStartAt <= now;
  const hasEnded = Boolean(event.salesEndAt && event.salesEndAt < now);

  let status: ClientEventDetailSales["status"];

  if (soldOut) {
    status = "SOLD_OUT";
  } else if (!hasStarted) {
    status = "NOT_STARTED";
  } else if (hasEnded) {
    status = "ENDED";
  } else if (hasPurchasableTicketType) {
    status = "OPEN";
  } else {
    status = "UNAVAILABLE";
  }

  return {
    startsAt: toIsoString(event.salesStartAt),
    endsAt: toIsoString(event.salesEndAt),
    hasStarted,
    hasEnded,
    isOpen: status === "OPEN",
    status,
  };
}

async function getOrganizerPublicStats(
  organizerId: string,
): Promise<{
  publishedEventsCount: number;
  soldTicketsCount: number;
  paidOrdersCount: number;
}> {
  const [
    publishedEventsCount,
    soldTicketsCount,
    paidOrdersCount,
  ] = await prisma.$transaction([
    prisma.event.count({
      where: {
        organizerId,
        status: EventStatus.PUBLISHED,
      },
    }),
    prisma.ticket.count({
      where: {
        event: {
          organizerId,
        },
        status: {
          in: [TicketStatus.VALID, TicketStatus.USED],
        },
      },
    }),
    prisma.order.count({
      where: {
        event: {
          organizerId,
        },
        status: OrderStatus.PAID,
      },
    }),
  ]);

  return {
    publishedEventsCount,
    soldTicketsCount,
    paidOrdersCount,
  };
}

function mapEventDetail({
  event,
  ticketTypes,
  organizerStats,
  now,
}: {
  event: SelectedPublicEvent;
  ticketTypes: ClientEventDetailTicketType[];
  organizerStats: {
    publishedEventsCount: number;
    soldTicketsCount: number;
    paidOrdersCount: number;
  };
  now: Date;
}): ClientEventDetail {
  const organizerName = getOrganizerName(event);

  const soldTicketsCount = ticketTypes.reduce(
    (total, ticketType) => total + ticketType.soldTickets,
    0,
  );

  const ticketCapacity = ticketTypes.reduce(
    (total, ticketType) => total + ticketType.quantity,
    0,
  );

  const capacity = Math.max(event.capacity, ticketCapacity, 0);
  const availableTickets = Math.max(
    capacity - soldTicketsCount,
    0,
  );

  const soldOut = capacity > 0 && availableTickets === 0;

  const hasPurchasableTicketType = ticketTypes.some(
    (ticketType) =>
      ticketType.canPurchase &&
      ticketType.availableTickets > 0,
  );

  const organizerProfile = event.organizer.organizerProfile;

  return {
    id: event.id,
    slug: event.slug,
    title: event.title.trim(),
    shortDescription: event.shortDescription?.trim() || null,
    description: event.description.trim(),
    coverImage: event.coverImage ?? event.images[0]?.publicUrl ?? null,
    images: event.images.map((image) => ({
      id: image.id,
      publicUrl: image.publicUrl,
      isCover: image.isCover,
      position: image.position,
    })),
    venueName: event.venueName.trim(),
    address: event.address.trim(),
    city: event.city.trim(),
    country: event.country.trim(),
    countryCode: event.countryCode.trim().toUpperCase(),
    timezone: event.timezone.trim(),
    latitude: event.latitude ? toNumber(event.latitude) : null,
    longitude: event.longitude ? toNumber(event.longitude) : null,
    startsAt: event.startsAt.toISOString(),
    endsAt: toIsoString(event.endsAt),
    salesStartAt: toIsoString(event.salesStartAt),
    salesEndAt: toIsoString(event.salesEndAt),
    currency: event.currency || DEFAULT_CURRENCY,
    platformFeeRate: Math.max(
      toNumber(event.platformFeeRate),
      0,
    ),
    isFree: event.isFree,
    isFeatured: event.isFeatured,
    publishedAt: toIsoString(event.publishedAt),
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
    category:
      event.category && event.category.isActive
        ? {
            id: event.category.id,
            name: event.category.name,
            slug: event.category.slug,
            icon: event.category.icon,
            description: event.category.description,
          }
        : null,
    organizer: {
      id: event.organizer.id,
      name: organizerName.name,
      businessName: organizerName.businessName,
      displayName: organizerName.displayName,
      logo: organizerProfile?.logo ?? null,
      avatar: organizerProfile?.avatar ?? null,
      description: organizerProfile?.description?.trim() || null,
      businessType: organizerProfile?.businessType?.trim() || null,
      website: organizerProfile?.website?.trim() || null,
      address: organizerProfile?.address?.trim() || null,
      city: organizerProfile?.city?.trim() || null,
      facebook: organizerProfile?.facebook?.trim() || null,
      instagram: organizerProfile?.instagram?.trim() || null,
      x: organizerProfile?.x?.trim() || null,
      linkedin: organizerProfile?.linkedin?.trim() || null,
      hasBlueBadge: organizerProfile?.hasBlueBadge ?? false,
      publishedEventsCount: organizerStats.publishedEventsCount,
      soldTicketsCount: organizerStats.soldTicketsCount,
      paidOrdersCount: organizerStats.paidOrdersCount,
    },
    ticketTypes,
    availability: {
      capacity,
      soldTickets: soldTicketsCount,
      availableTickets,
      soldOut,
    },
    sales: getEventSales({
      event,
      now,
      soldOut,
      hasPurchasableTicketType,
    }),
    price: getEventPrice({
      event,
      ticketTypes,
    }),
    paidOrdersCount: event.orders.length,
    soldTicketsCount,
  };
}

export async function getClientEventDetail({
  slug,
  now = new Date(),
}: GetClientEventDetailInput): Promise<
  GetClientEventDetailResult | null
> {
  const normalizedSlug = normalizeSlug(slug);

  const event = await prisma.event.findFirst({
    where: {
      slug: normalizedSlug,
      status: EventStatus.PUBLISHED,
      organizer: {
        is: {
          isActive: true,
        },
      },
    },
    select: publicEventDetailSelect,
  });

  if (!event) {
    return null;
  }

  const ticketTypes = mapTicketTypes({
    event,
    now,
  });

  const organizerStats = await getOrganizerPublicStats(
    event.organizerId,
  );

  return {
    generatedAt: now.toISOString(),
    event: mapEventDetail({
      event,
      ticketTypes,
      organizerStats,
      now,
    }),
  };
}