import { getTrustedRequestOrigin } from "@/lib/tikemia-pay/providers";
import { getPlatformPrisma } from "@/lib/payments/fulfillment";
import { SUPPORTED_CURRENCIES, currencyDecimals } from "@/i18n/config";
import { createClient } from "@supabase/supabase-js";

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";

import { PrismaClient } from "@/generated/prisma/client";

/* ============================================
   TIKEMIA — GESTION D'UN ÉVÉNEMENT

   GET    /api/organizer/events/[id]
   PATCH  /api/organizer/events/[id]
   DELETE /api/organizer/events/[id]

   - Authentification obligatoire
   - Vérification de l'organisation
   - Préremplissage du formulaire
   - Modification transactionnelle
   - Protection des commandes
   - Annulation contrôlée
   - FR / EN
============================================ */


type Context = {
  params: Promise<{ id: string }>;
};

type Locale = "fr" | "en";
type Currency = (typeof SUPPORTED_CURRENCIES)[number];

type ScheduleType =
  | "SINGLE_DATE"
  | "DATE_RANGE"
  | "CONTINUOUS";

type ImageInput = {
  id: string;
};

type TicketInput = {
  id?: string;
  name: string;
  price: bigint;
  quantity: number;
};

type EventInput = {
  title: string;
  category: string;
  description: string;
  countryCode: string;
  city: string;
  address: string;
  venueName: string;
  timezone: string;
  currency: Currency;
  capacity: number;
  scheduleType: ScheduleType;
  startDate: string;
  startTime: string;
  endDate: string | null;
  endTime: string | null;
  tickets: TicketInput[];
  keepImageIds: string[];
  newImages: ImageInput[];
};

type AuthContext = {
  userId: string;
  organizationIds: string[];
};

const SESSION_COOKIE = "tikemia_organizer_session";
const MAX_JSON_BYTES = 64 * 1024;
const MAX_IMAGES = 10;
const MAX_CAPACITY = 1_000_000;
const MAX_PRICE = 999_999_999n;

const IMAGE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EVENT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CATEGORIES = new Set([
  "concerts",
  "culture",
  "formation",
  "soirees",
  "tourisme",
  "sport",
  "festival",
  "science",
  "religieux",
  "gastronomie",
  "business",
  "autres",
]);

const CURRENCIES = new Set<string>(SUPPORTED_CURRENCIES);

const TEXT = {
  fr: {
    unauthorized: "Connexion organisateur requise.",
    forbidden: "Accès non autorisé.",
    notFound: "Événement introuvable.",
    invalid: "Informations de l'événement invalides.",
    invalidImages: "Les images sélectionnées sont invalides.",
    invalidTickets: "Catégories de billets invalides.",
    invalidDates: "Dates ou heures invalides.",
    invalidCapacity:
      "La capacité doit correspondre aux catégories de billets.",
    protected:
      "Cet événement possède déjà des commandes. Ces modifications nécessitent une procédure spécifique.",
    cancelled:
      "Cet événement ne peut plus être modifié.",
    saved: "Les modifications ont été enregistrées.",
    removed: "L'événement a été retiré de la publication.",
    serverError: "Opération indisponible.",
  },
  en: {
    unauthorized: "Organizer authentication required.",
    forbidden: "Access denied.",
    notFound: "Event not found.",
    invalid: "Invalid event information.",
    invalidImages: "Invalid selected images.",
    invalidTickets: "Invalid ticket categories.",
    invalidDates: "Invalid dates or times.",
    invalidCapacity:
      "Capacity must match ticket category quantities.",
    protected:
      "This event already has orders. These changes require a separate procedure.",
    cancelled: "This event can no longer be edited.",
    saved: "Changes saved successfully.",
    removed: "Event removed from publication.",
    serverError: "Operation unavailable.",
  },
} as const;

type MessageKey = keyof typeof TEXT.fr;

/* ============================================
   PRISMA
============================================ */



const getPrisma = getPlatformPrisma;

/* ============================================
   RÉPONSES
============================================ */

function language(request: NextRequest): Locale {
  const locale = request.nextUrl.searchParams.get("locale");

  if (locale === "fr" || locale === "en") {
    return locale;
  }

  return request.headers
    .get("accept-language")
    ?.toLowerCase()
    .startsWith("en")
    ? "en"
    : "fr";
}

function reply(
  data: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      Vary: "Cookie",
    },
  });
}

function fail(
  locale: Locale,
  key: MessageKey,
  status: number
) {
  return reply(
    {
      success: false,
      message: TEXT[locale][key],
    },
    status
  );
}

function validOrigin(request: NextRequest): boolean {
  const site = request.headers.get("sec-fetch-site");
  const origin = request.headers.get("origin");

  if (site && site !== "same-origin") {
    return false;
  }

  return Boolean(origin && origin === getTrustedRequestOrigin(request));
}

/* ============================================
   SESSION ORGANISATEUR
============================================ */

async function authenticate(
  request: NextRequest,
  prisma: PrismaClient
): Promise<AuthContext | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
    return null;
  }

  const tokenHash = createHash("sha256")
    .update(token, "utf8")
    .digest("hex");

  const session = await prisma.session.findUnique({
    where: { tokenHash },
    select: {
      userId: true,
      expiresAt: true,
      revokedAt: true,
    },
  });

  if (
    !session ||
    session.revokedAt !== null ||
    session.expiresAt <= new Date()
  ) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      isActive: true,
      isBlocked: true,
      emailVerifiedAt: true,
      roles: {
        where: { role: "ORGANIZER" },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (
    !user ||
    !user.isActive ||
    user.isBlocked ||
    !user.emailVerifiedAt ||
    user.roles.length === 0
  ) {
    return null;
  }

  const organizations = await prisma.organization.findMany({
    where: {
      ownerId: user.id,
      isActive: true,
    },
    select: { id: true },
  });

  if (organizations.length === 0) {
    return null;
  }

  return {
    userId: user.id,
    organizationIds: organizations.map((item) => item.id),
  };
}

/* ============================================
   VALIDATION
============================================ */

function cleanText(
  value: unknown,
  min: number,
  max: number
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const result = value.trim();

  if (
    result.length < min ||
    result.length > max ||
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(
      result
    )
  ) {
    return null;
  }

  return result;
}

function integerValue(
  value: unknown,
  min: number,
  max: number
): number | null {
  const raw = String(value ?? "");

  if (!/^\d+$/.test(raw)) {
    return null;
  }

  const parsed = Number(raw);

  return Number.isSafeInteger(parsed) &&
    parsed >= min &&
    parsed <= max
    ? parsed
    : null;
}

function priceValue(value: unknown, currency: string): bigint | null {
 const raw = String(value ?? "").trim().replace(/\s/g, "").replace(",", ".");
 if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(raw)) return null;
 const [whole, fraction = ""] = raw.split(".");
 if (currencyDecimals(currency) === 0 && /[1-9]/.test(fraction)) return null;
 const factor = currencyDecimals(currency) === 0 ? 1n : 100n;
 const amount = BigInt(whole) * factor + (currencyDecimals(currency) === 0 ? 0n : BigInt(fraction.padEnd(2, "0")));
 return amount <= MAX_PRICE * factor ? amount : null;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function validTime(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    return false;
  }

  const [hour, minute] = value.split(":").map(Number);

  return hour >= 0 && hour < 24 &&
    minute >= 0 && minute < 60;
}

function validTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", {
      timeZone: value,
    });
    return true;
  } catch {
    return false;
  }
}

function validCountry(value: string): boolean {
  return /^[A-Z]{2}$/.test(value);
}

function normalizeImageList(
  value: unknown
): string[] | null {
  if (!Array.isArray(value) || value.length > MAX_IMAGES) {
    return null;
  }

  const ids: string[] = [];

  for (const item of value) {
    const id =
      typeof item === "string"
        ? item
        : item &&
            typeof item === "object" &&
            "id" in item
          ? item.id
          : null;

    if (
      typeof id !== "string" ||
      !IMAGE_ID_PATTERN.test(id)
    ) {
      return null;
    }

    ids.push(id.toLowerCase());
  }

  return new Set(ids).size === ids.length ? ids : null;
}

function parseInput(
  body: unknown
):
  | { ok: true; data: EventInput }
  | { ok: false; error: MessageKey } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "invalid" };
  }

  const raw = body as Record<string, unknown>;

  const title = cleanText(raw.title, 3, 180);
  const description = cleanText(raw.description, 10, 2000);
  const category = cleanText(raw.category, 1, 50);

  const countryCode =
    typeof raw.countryCode === "string"
      ? raw.countryCode.trim().toUpperCase()
      : "";

  const city = cleanText(raw.city, 1, 120);
  const address = cleanText(raw.address, 1, 250);

  const venueName =
    cleanText(raw.venueName, 1, 250) ?? address;

  const timezone =
    typeof raw.timezone === "string"
      ? raw.timezone.trim()
      : "";

  const currency =
    typeof raw.currency === "string"
      ? raw.currency.toUpperCase()
      : "";

  const capacity = integerValue(
    raw.capacity,
    1,
    MAX_CAPACITY
  );

  if (
    !title ||
    !description ||
    !category ||
    !CATEGORIES.has(category) ||
    !city ||
    !address ||
    !venueName ||
    !validCountry(countryCode) ||
    !validTimezone(timezone) ||
    !CURRENCIES.has(currency) ||
    capacity === null
  ) {
    return { ok: false, error: "invalid" };
  }

  const scheduleType = raw.scheduleType;

  if (
    scheduleType !== "SINGLE_DATE" &&
    scheduleType !== "DATE_RANGE" &&
    scheduleType !== "CONTINUOUS"
  ) {
    return { ok: false, error: "invalidDates" };
  }

  const startDate =
    typeof raw.startDate === "string"
      ? raw.startDate
      : "";

  const startTime =
    typeof raw.startTime === "string"
      ? raw.startTime
      : "";

  const endDate =
    typeof raw.endDate === "string"
      ? raw.endDate || null
      : null;

  const endTime =
    typeof raw.endTime === "string"
      ? raw.endTime || null
      : null;

  if (
    !validDate(startDate) ||
    !validTime(startTime) ||
    (scheduleType === "DATE_RANGE" && !endDate) ||
    (endDate !== null && !validDate(endDate)) ||
    (endTime !== null && !validTime(endTime))
  ) {
    return { ok: false, error: "invalidDates" };
  }

  if (
    scheduleType !== "SINGLE_DATE" &&
    endDate &&
    `${endDate}T${endTime ?? "23:59"}` <=
      `${startDate}T${startTime}`
  ) {
    return { ok: false, error: "invalidDates" };
  }

  if (!Array.isArray(raw.ticketCategories)) {
    return { ok: false, error: "invalidTickets" };
  }

  if (
    raw.ticketCategories.length < 1 ||
    raw.ticketCategories.length > 100
  ) {
    return { ok: false, error: "invalidTickets" };
  }

  const tickets: TicketInput[] = [];
  const names = new Set<string>();

  for (const item of raw.ticketCategories) {
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item)
    ) {
      return { ok: false, error: "invalidTickets" };
    }

    const entry = item as Record<string, unknown>;

    const name = cleanText(entry.name, 1, 80);
    const price = priceValue(entry.price, currency);
    const quantity = integerValue(
      entry.quantity,
      1,
      MAX_CAPACITY
    );

    if (
      !name ||
      price === null ||
      quantity === null
    ) {
      return { ok: false, error: "invalidTickets" };
    }

    const key = name.toLocaleLowerCase();

    if (names.has(key)) {
      return { ok: false, error: "invalidTickets" };
    }

    names.add(key);

    tickets.push({
      id:
        typeof entry.id === "string" &&
        EVENT_ID_PATTERN.test(entry.id)
          ? entry.id
          : undefined,
      name,
      price,
      quantity,
    });
  }

  const total = tickets.reduce(
    (sum, ticket) => sum + ticket.quantity,
    0
  );

  if (total !== capacity) {
    return { ok: false, error: "invalidCapacity" };
  }

  const keepImageIds =
    normalizeImageList(raw.keepImageIds ?? []);

  const newImages =
    normalizeImageList(raw.images ?? []);

  if (!keepImageIds || !newImages) {
    return { ok: false, error: "invalidImages" };
  }

  const allIds = [...keepImageIds, ...newImages];

  if (
    allIds.length < 1 ||
    allIds.length > MAX_IMAGES ||
    new Set(allIds).size !== allIds.length
  ) {
    return { ok: false, error: "invalidImages" };
  }

  return {
    ok: true,
    data: {
      title,
      category,
      description,
      countryCode,
      city,
      address,
      venueName,
      timezone,
      currency: currency as Currency,
      capacity,
      scheduleType,
      startDate,
      startTime,
      endDate:
        scheduleType === "SINGLE_DATE"
          ? null
          : endDate,
      endTime:
        scheduleType === "SINGLE_DATE"
          ? null
          : endTime,
      tickets,
      keepImageIds,
      newImages: newImages.map((id) => ({ id })),
    },
  };
}

/* ============================================
   DATES ET FUSEAUX HORAIRES

   Conversion UTC -> fuseau pour GET.
   Conversion locale -> UTC pour PATCH.
   Rejette les heures inexistantes lors
   du passage à l'heure d'été.
============================================ */

function zonedParts(
  date: Date,
  timezone: string
) {
  const parts = new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }
  ).formatToParts(date);

  const read = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return {
    date: `${read("year")}-${read("month")}-${read("day")}`,
    time: `${read("hour")}:${read("minute")}`,
  };
}

function localToUtc(
  date: string,
  time: string,
  timezone: string
): Date {
  const target = `${date}T${time}`;

  const guess = Date.parse(`${target}:00Z`);

  let timestamp = guess;

  for (let attempt = 0; attempt < 5; attempt++) {
    const current = zonedParts(
      new Date(timestamp),
      timezone
    );

    const represented = Date.parse(
      `${current.date}T${current.time}:00Z`
    );

    timestamp += guess - represented;
  }

  const result = new Date(timestamp);
  const actual = zonedParts(result, timezone);

  if (`${actual.date}T${actual.time}` !== target) {
    throw new Error("INVALID_LOCAL_DATETIME");
  }

  return result;
}

function getImageId(storageKey: string): string | null {
  const match = storageKey.match(
    /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(?:jpg|png|webp)$/i
  );

  return match?.[1]?.toLowerCase() ?? null;
}

/* ============================================
   STOCKAGE EXISTANT DES IMAGES

   Cette vérification correspond au
   stockage local des routes actuelles.

   Lors du passage définitif vers
   Supabase Storage, remplacer cette
   fonction par un contrôle côté Supabase.
============================================ */

const STORAGE_BUCKET = "event-images";

let storageClient: ReturnType<typeof createClient> | undefined;

function getBucket() {

  if (!storageClient) {

    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) throw new Error("SUPABASE_STORAGE_NOT_CONFIGURED");

    storageClient = createClient(url, key, {

      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },

      global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: init?.signal ?? AbortSignal.timeout(10_000) }) },

    });

  }

  return storageClient.storage.from(STORAGE_BUCKET);

}

async function findStorageObject(userId: string, id: string, maxBytes: number) {

  const prefix = createHash("sha256").update(userId, "utf8").digest("hex");

  for (const [extension, contentType] of [["jpg", "image/jpeg"], ["png", "image/png"], ["webp", "image/webp"]] as const) {

    const storageKey = `${prefix}/${id.toLowerCase()}.${extension}`;

    const { data, error } = await getBucket().info(storageKey);

    if (error) {

      const status = Number(error.statusCode ?? error.status ?? 0);

      const code = "code" in error ? String(error.code) : "";

      if (status === 404 || code === "NoSuchKey" || code === "not_found") continue;

      throw error;

    }

    const size = data.size ?? data.metadata?.size ?? 0;

    const mime = data.contentType ?? data.metadata?.mimetype;

    if (size > 0 && size <= maxBytes && mime === contentType) return { storageKey, contentType };

  }

  return null;

}


async function resolveNewImage(organizerId: string, imageId: string): Promise<string | null> {
  return (await findStorageObject(organizerId, imageId, 10 * 1024 * 1024))?.storageKey ?? null;
}


/* ============================================
   RÉCUPÉRER UN ÉVÉNEMENT AUTORISÉ
============================================ */

async function findEvent(
  prisma: PrismaClient,
  id: string,
  organizationIds: string[]
) {
  return prisma.event.findFirst({
    where: {
      id,
      organizationId: {
        in: organizationIds,
      },
    },
    include: {
      venue: true,
      schedules: {
        orderBy: { startsAt: "asc" },
      },
      images: {
        orderBy: { position: "asc" },
      },
      categories: {
        orderBy: { name: "asc" },
      },
    },
  });
}

/* ============================================
   GET — DÉTAILS POUR MODIFICATION
============================================ */

export async function GET(
  request: NextRequest,
  context: Context
) {
  const locale = language(request);

  try {
    const prisma = getPrisma();
    const auth = await authenticate(request, prisma);

    if (!auth) {
      return fail(locale, "unauthorized", 401);
    }

    const { id } = await context.params;

    if (!EVENT_ID_PATTERN.test(id)) {
      return fail(locale, "invalid", 400);
    }

    const event = await findEvent(
      prisma,
      id,
      auth.organizationIds
    );

    if (!event) {
      return fail(locale, "notFound", 404);
    }

    const timezone =
      event.timeZone &&
      validTimezone(event.timeZone)
        ? event.timeZone
        : "UTC";

    const firstSchedule = event.schedules[0];

    const start = firstSchedule
      ? zonedParts(firstSchedule.startsAt, timezone)
      : null;

    const end =
      firstSchedule?.endsAt
        ? zonedParts(firstSchedule.endsAt, timezone)
        : null;

    const images = event.images.map(
      (image) => {
        const imageId = getImageId(image.storageKey);

        return {
          id: imageId ?? image.id,
          position: image.position,
          url: imageId
            ? `/api/organizer/events/images?id=${encodeURIComponent(imageId)}`
            : null,
        };
      }
    );

    const detailed = request.nextUrl.searchParams.get("details") === "1";
    const paidWhere = { eventId: event.id, currency: event.currency, order: { status: "PAID" as const } };
    const [totals, categoryTotals, orderRows, ordersTotal] = detailed ? await Promise.all([
      prisma.orderLine.aggregate({ where: paidWhere, _sum: { quantity: true, subtotal: true } }),
      prisma.orderLine.groupBy({ by: ["ticketCategoryId"], where: paidWhere, _sum: { quantity: true, subtotal: true } }),
      prisma.order.findMany({ where: { lines: { some: { eventId: event.id } } }, orderBy: { createdAt: "desc" }, take: 500, select: { id: true, reference: true, guestEmail: true, buyer: { select: { phoneE164: true } }, status: true, createdAt: true, currency: true, lines: { where: { eventId: event.id }, select: { quantity: true, subtotal: true } } } }),
      prisma.order.count({ where: { lines: { some: { eventId: event.id } } } }),
    ]) : [null, [], [], null];
    const paidOrderCount = detailed ? await prisma.order.count({ where: { status: "PAID", lines: { some: { eventId: event.id } } } }) : null;
    const sold = totals?._sum.quantity ?? 0;
    const buyers = new Map<string, { id: string; email: string; phone: string; orders: number; tickets: number }>();
    for (const order of orderRows) {
      if (order.status !== "PAID") continue;
      const key = order.guestEmail.trim().toLowerCase();
      const buyer = buyers.get(key) ?? { id: order.id, email: order.guestEmail, phone: order.buyer?.phoneE164 ?? "", orders: 0, tickets: 0 };
      buyer.orders++; buyer.tickets += order.lines.reduce((sum, line) => sum + line.quantity, 0); buyers.set(key, buyer);
    }
    return reply({
      success: true,

      event: {
        id: event.id,
        title: event.title,
        status: event.status,
        venueName: event.venue?.name ?? "",
        description: event.description,
        category: event.category,

        countryCode: event.venue?.country ?? "",
        city: event.venue?.city ?? "",
        address: event.venue?.address ?? "",

        timezone,
        currency: event.currency,
        capacity: event.capacity,
        ...(detailed ? { statistics: { paidOrders: paidOrderCount, ticketsSold: sold, remainingSeats: Math.max(0, event.capacity - sold), grossRevenue: String(totals?._sum.subtotal ?? 0n), occupancyRate: event.capacity ? sold * 100 / event.capacity : 0 }, ordersTotal, buyersTotal: ordersTotal !== null && ordersTotal <= 500 ? buyers.size : null, orders: orderRows.map(order => ({ id: order.id, reference: order.reference, email: order.guestEmail, phone: order.buyer?.phoneE164 ?? "", quantity: order.lines.reduce((sum, line) => sum + line.quantity, 0), amount: String(order.lines.reduce((sum, line) => sum + line.subtotal, 0n)), currency: order.currency, status: order.status, createdAt: order.createdAt.toISOString() })), buyers: [...buyers.values()] } : {}),

        scheduleType: event.scheduleKind,
        startDate: start?.date ?? "",
        startTime: start?.time ?? "",
        endDate: end?.date ?? null,
        endTime: end?.time ?? null,

        images,

        ticketCategories:
          event.categories.map(
            (ticket) => ({
              id: ticket.id,
              name: ticket.name,
              price: String(ticket.price),
              inputPrice: currencyDecimals(event.currency) === 0 ? String(ticket.price) : `${ticket.price / 100n}.${String(ticket.price % 100n).padStart(2, "0")}`,
              quantity: ticket.capacity,
              ...(detailed ? { sold: categoryTotals.find(row => row.ticketCategoryId === ticket.id)?._sum.quantity ?? 0, remaining: Math.max(0, ticket.capacity - (categoryTotals.find(row => row.ticketCategoryId === ticket.id)?._sum.quantity ?? 0)), revenue: String(categoryTotals.find(row => row.ticketCategoryId === ticket.id)?._sum.subtotal ?? 0n) } : {}),
            })
          ),
      },
    });
  } catch (error) {
    console.error(
      "[TIKEMIA EVENT GET]",
      error instanceof Error ? error.message : error
    );

    return fail(locale, "serverError", 503);
  }
}

/* ============================================
   PATCH — MODIFIER UN ÉVÉNEMENT

   Protection renforcée :

   - Seul le propriétaire modifie
   - Modification interdite si l'événement
     possède déjà une commande
   - Les images conservées doivent être
     associées à l'événement
   - Les images nouvelles doivent appartenir
     au stockage de l'organisateur
   - Transaction PostgreSQL

   Cette règle est volontairement stricte
   pour préserver les billets achetés.
============================================ */

export async function PATCH(
  request: NextRequest,
  context: Context
) {
  const locale = language(request);

  try {
    if (!validOrigin(request)) {
      return fail(locale, "forbidden", 403);
    }

    const prisma = getPrisma();
    const auth = await authenticate(request, prisma);

    if (!auth) {
      return fail(locale, "unauthorized", 401);
    }

    const { id } = await context.params;

    if (!EVENT_ID_PATTERN.test(id)) {
      return fail(locale, "invalid", 400);
    }

    const contentType =
      request.headers.get("content-type") ?? "";

    if (
      !contentType.toLowerCase().startsWith(
        "application/json"
      )
    ) {
      return fail(locale, "invalid", 415);
    }

    const rawBody = await request.text();

    if (
      Buffer.byteLength(rawBody, "utf8") >
      MAX_JSON_BYTES
    ) {
      return fail(locale, "invalid", 413);
    }

    let body: unknown;

    try {
      body = JSON.parse(rawBody);
    } catch {
      return fail(locale, "invalid", 400);
    }

    const parsed = parseInput(body);

    if (!parsed.ok) {
      return fail(locale, parsed.error, 400);
    }

    const input = parsed.data;

    const existing = await findEvent(
      prisma,
      id,
      auth.organizationIds
    );

    if (!existing) {
      return fail(locale, "notFound", 404);
    }

    if (
      existing.status === "CANCELLED" ||
      existing.status === "COMPLETED"
    ) {
      return fail(locale, "cancelled", 409);
    }

    // Toutes les commandes sont prises en compte,
    // pas seulement les commandes payées.

    const existingOrderLine =
      await prisma.orderLine.findFirst({
        where: {
          eventId: id,
        },
        select: { id: true },
      });

    if (existingOrderLine) {
      return fail(locale, "protected", 409);
    }

    const storedImageIds = new Map(
      existing.images.map((image) => [
        getImageId(image.storageKey) ?? image.id,
        image.storageKey,
      ])
    );

    for (const imageId of input.keepImageIds) {
      if (!storedImageIds.has(imageId)) {
        return fail(locale, "invalidImages", 400);
      }
    }

    const newImageStorageKeys: string[] = [];

    for (const image of input.newImages) {
      const storageKey = await resolveNewImage(
        auth.userId,
        image.id
      );

      if (!storageKey) {
        return fail(locale, "invalidImages", 400);
      }

      newImageStorageKeys.push(storageKey);
    }

    const finalStorageKeys = [
      ...input.keepImageIds.map(
        (imageId) => storedImageIds.get(imageId)!
      ),
      ...newImageStorageKeys,
    ];

    if (
      finalStorageKeys.length < 1 ||
      finalStorageKeys.length > MAX_IMAGES ||
      new Set(finalStorageKeys).size !==
        finalStorageKeys.length
    ) {
      return fail(locale, "invalidImages", 400);
    }

    let startsAt: Date;
    let endsAt: Date | null = null;

    try {
      startsAt = localToUtc(
        input.startDate,
        input.startTime,
        input.timezone
      );

      if (input.endDate) {
        endsAt = localToUtc(
          input.endDate,
          input.endTime ?? "23:59",
          input.timezone
        );
      }

      if (
        endsAt &&
        endsAt.getTime() <= startsAt.getTime()
      ) {
        return fail(locale, "invalidDates", 400);
      }
    } catch {
      return fail(locale, "invalidDates", 400);
    }

    const saved = await prisma.$transaction(
      async (tx) => {
        // Une deuxième vérification réduit le risque
        // de modifier un événement devenu réservé
        // depuis le premier contrôle.

        const order = await tx.orderLine.findFirst({
          where: { eventId: id },
          select: { id: true },
        });

        if (order) {
          throw new Error("EVENT_HAS_ORDERS");
        }

        const current = await tx.event.findFirst({
          where: {
            id,
            organizationId: {
              in: auth.organizationIds,
            },
          },
          select: {
            id: true,
            status: true,
          },
        });

        if (
          !current ||
          current.status === "CANCELLED" ||
          current.status === "COMPLETED"
        ) {
          throw new Error("EVENT_NOT_EDITABLE");
        }

        // Cette version ne modifie pas des données
        // de commande ; toutes les sous-collections
        // remplacées n'ont aucune vente associée.

        await tx.eventImage.deleteMany({
          where: { eventId: id },
        });

        await tx.eventSchedule.deleteMany({
          where: { eventId: id },
        });

        await tx.ticketCategory.deleteMany({
          where: { eventId: id },
        });

        const updated = await tx.event.update({
          where: { id },

          data: {
            status: "PUBLISHED",
            publishedAt: new Date(),
            title: input.title,
            description: input.description,
            category: input.category,
            currency: input.currency,
            capacity: input.capacity,
            timeZone: input.timezone,
            scheduleKind: input.scheduleType,

            venue: {
              upsert: {
                create: {
                  name: input.venueName,
                  country: input.countryCode,
                  city: input.city,
                  address: input.address,
                },
                update: {
                  name: input.venueName,
                  country: input.countryCode,
                  city: input.city,
                  address: input.address,
                },
              },
            },

            schedules: {
              create: {
                startsAt,
                endsAt,
              },
            },

            categories: {
              create: input.tickets.map(
                (ticket) => ({
                  name: ticket.name,
                  price: ticket.price,
                  currency: input.currency,
                  capacity: ticket.quantity,
                })
              ),
            },

            images: {
              create: finalStorageKeys.map(
                (storageKey, index) => ({
                  storageKey,
                  position: index,
                  isPrimary: index === 0,
                })
              ),
            },
          },

          select: {
            id: true,
            status: true,
            updatedAt: true,
          },
        });

        return updated;
      },
      {
        isolationLevel: "Serializable",
        timeout: 15000,
      }
    );

    return reply({
      success: true,
      message: TEXT[locale].saved,
      event: {
        id: saved.id,
        status: saved.status,
        updatedAt: saved.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "";

    if (
      message === "EVENT_HAS_ORDERS" ||
      message === "EVENT_NOT_EDITABLE"
    ) {
      return fail(locale, "protected", 409);
    }

    console.error(
      "[TIKEMIA EVENT PATCH]",
      message || "Unknown error"
    );

    return fail(locale, "serverError", 503);
  }
}

/* ============================================
   DELETE — RETIRER UN ÉVÉNEMENT

   Nous ne détruisons pas physiquement les
   événements liés aux flux financiers.

   L'événement sans commande est marqué
   CANCELLED et retiré de la vente.

   Le contenu historique reste en base
   pour l'audit et la modération.
============================================ */

export async function DELETE(
  request: NextRequest,
  context: Context
) {
  const locale = language(request);

  try {
    if (!validOrigin(request)) {
      return fail(locale, "forbidden", 403);
    }

    const prisma = getPrisma();
    const auth = await authenticate(request, prisma);

    if (!auth) {
      return fail(locale, "unauthorized", 401);
    }

    const { id } = await context.params;

    if (!EVENT_ID_PATTERN.test(id)) {
      return fail(locale, "invalid", 400);
    }

    const event = await prisma.event.findFirst({
      where: {
        id,
        organizationId: {
          in: auth.organizationIds,
        },
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!event) {
      return fail(locale, "notFound", 404);
    }

    if (event.status === "CANCELLED") {
      return reply({
        success: true,
        message: TEXT[locale].removed,
        id: event.id,
      });
    }

    const existingOrder =
      await prisma.orderLine.findFirst({
        where: { eventId: id },
        select: { id: true },
      });

    if (existingOrder) {
      return fail(locale, "protected", 409);
    }

    await prisma.$transaction(
      async (tx) => {
        const order = await tx.orderLine.findFirst({
          where: { eventId: id },
          select: { id: true },
        });

        if (order) {
          throw new Error("EVENT_HAS_ORDERS");
        }

        await tx.event.update({
          where: { id },
          data: {
            status: "CANCELLED",
          },
        });
      },
      {
        isolationLevel: "Serializable",
        timeout: 15000,
      }
    );

    return reply({
      success: true,
      message: TEXT[locale].removed,
      id,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "EVENT_HAS_ORDERS"
    ) {
      return fail(locale, "protected", 409);
    }

    console.error(
      "[TIKEMIA EVENT DELETE]",
      error instanceof Error ? error.message : error
    );

    return fail(locale, "serverError", 503);
  }
}
