import { getTrustedRequestOrigin } from "@/lib/tikemia-pay/providers";
import { getPlatformPrisma } from "@/lib/payments/fulfillment";
import { publicationSlug as titleSlug } from "@/i18n/config";
import { isSupportedCurrency } from "@/i18n/config";
import { createClient } from "@supabase/supabase-js";

import { NextRequest, NextResponse } from "next/server";

import { createHash } from "node:crypto";

import { PrismaClient, type Prisma } from "@/generated/prisma/client";

import { isSupportedCountry } from "libphonenumber-js";

/* ============================================

   TIKEMIA — PUBLICATION DES ÉVÉNEMENTS

   POST /api/organizer/events

   Technologies :

   - Next.js App Router

   - TypeScript

   - Prisma ORM 7

   - PostgreSQL

   Sécurité :

   - Session obligatoire

   - Email vérifié

   - Rôle ORGANIZER obligatoire

   - Validation des données serveur

   - Vérification des images enregistrées

   - Contrôle des places et des prix

   - Dates converties en UTC

   - Enregistrement transactionnel

   Statut initial :

   PENDING_REVIEW

============================================ */

/* ============================================

   CONFIGURATION

============================================ */

const SESSION_COOKIE = "tikemia_organizer_session";

const MAX_BODY_BYTES = 64 * 1024;

const MAX_IMAGES = 10;

const MAX_TICKET_CATEGORIES = 30;

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const MAX_CAPACITY = 1_000_000;

const MAX_TICKET_PRICE = 999_999_999;

type Language = "fr" | "en";

type ScheduleType =

  | "SINGLE_DATE"

  | "DATE_RANGE"

  | "CONTINUOUS";

type InputRecord = Record<string, unknown>;

type TicketInput = {

  name: string;

  price: number;

  quantity: number;

};

type ImageInput = {

  id: string;

};

type EventInput = {

  title: string;

  description: string;

  category: string;

  countryCode: string;

  city: string;

  address: string;

  venueName: string;

  timezone: string;

  currency: string;

  capacity: number;

  scheduleType: ScheduleType;

  startsAt: Date;

  endsAt: Date | null;

  tickets: TicketInput[];

  images: ImageInput[];

};

/* ============================================

   CATÉGORIES AUTORISÉES

============================================ */

const EVENT_CATEGORIES = new Set([

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

/* ============================================

   MESSAGES FR / EN

============================================ */

const TEXT = {

  fr: {

    unauthorized: "Connexion requise.",

    forbidden: "Accès non autorisé.",

    invalidRequest: "Requête invalide.",

    tooLarge: "Requête trop volumineuse.",

    invalidTitle: "Nom de l'événement invalide.",

    invalidDescription: "Description invalide.",

    invalidCategory: "Catégorie invalide.",

    invalidCountry: "Pays invalide.",

    invalidCity: "Ville invalide.",

    invalidAddress: "Adresse invalide.",

    invalidTimezone: "Fuseau horaire invalide.",

    invalidDate: "Date ou heure invalide.",

    invalidPeriod: "Période de l'événement invalide.",

    pastDate: "La date de début doit être future.",

    invalidCapacity: "Nombre de places invalide.",

    invalidTickets: "Catégories de billets invalides.",

    capacityMismatch:

      "Le total des places des catégories doit correspondre au nombre total de places.",

    invalidImages:

      "Ajoutez entre 1 et 10 images valides.",

    missingImages:

      "Une ou plusieurs images sont introuvables.",

    invalidCurrency: "Devise invalide.",

    unavailable:

      "Service temporairement indisponible.",

    success: "Evenement publie.",

  },

  en: {

    unauthorized: "Authentication required.",

    forbidden: "Access denied.",

    invalidRequest: "Invalid request.",

    tooLarge: "Request too large.",

    invalidTitle: "Invalid event name.",

    invalidDescription: "Invalid description.",

    invalidCategory: "Invalid category.",

    invalidCountry: "Invalid country.",

    invalidCity: "Invalid city.",

    invalidAddress: "Invalid address.",

    invalidTimezone: "Invalid timezone.",

    invalidDate: "Invalid date or time.",

    invalidPeriod: "Invalid event period.",

    pastDate: "The start date must be in the future.",

    invalidCapacity: "Invalid number of seats.",

    invalidTickets: "Invalid ticket categories.",

    capacityMismatch:

      "Ticket category quantities must equal the total capacity.",

    invalidImages:

      "Add between 1 and 10 valid images.",

    missingImages:

      "One or more images could not be found.",

    invalidCurrency: "Invalid currency.",

    unavailable:

      "Service temporarily unavailable.",

    success: "Event published.",

  },

} as const;

type MessageKey = keyof typeof TEXT.fr;

/* ============================================

   PRISMA ORM 7

============================================ */



const getPrisma = getPlatformPrisma;

/* ============================================

   RÉPONSES JSON

============================================ */

function respond(

  data: Record<string, unknown>,

  status = 200

) {

  return NextResponse.json(data, {

    status,

    headers: {

      "Cache-Control": "no-store",

      "X-Content-Type-Options": "nosniff",

    },

  });

}

function errorResponse(

  language: Language,

  key: MessageKey,

  status: number

) {

  return respond(

    {

      success: false,

      message: TEXT[language][key],

    },

    status

  );

}

/* ============================================

   LANGUE

============================================ */

function resolveLanguage(

  value: unknown

): Language {

  return value === "en" ? "en" : "fr";

}

/* ============================================

   CONTRÔLE DE L'ORIGINE

============================================ */

function isAllowedOrigin(

  request: NextRequest

): boolean {

  if (

    request.headers.get("sec-fetch-site") ===

    "cross-site"

  ) {

    return false;

  }

  const origin = request.headers.get("origin");

  if (!origin) {

    return request.headers.get("sec-fetch-site") === "same-origin";

  }

  return origin === getTrustedRequestOrigin(request);

}

/* ============================================

   VALIDATION DES TEXTES

============================================ */

function normalizeText(

  value: unknown,

  maxLength: number,

  minLength = 1

): string | null {

  if (typeof value !== "string") {

    return null;

  }

  const normalized = value

    .trim()

    .replace(/[ \t]+/g, " ");

  if (

    normalized.length < minLength ||

    normalized.length > maxLength ||

    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(

      normalized

    )

  ) {

    return null;

  }

  return normalized;

}

function normalizeCategory(

  value: unknown

): string | null {

  if (typeof value !== "string") {

    return null;

  }

  const category = value

    .trim()

    .toLowerCase()

    .normalize("NFD")

    .replace(/[\u0300-\u036f]/g, "")

    .replace(/[\s_-]+/g, "");

  return EVENT_CATEGORIES.has(category)

    ? category

    : null;

}

function normalizeCountry(

  value: unknown

): string | null {

  if (typeof value !== "string") {

    return null;

  }

  const country = value.trim().toUpperCase();

  return isSupportedCountry(country)

    ? country

    : null;

}

/* ============================================

   VALIDATION DES NOMBRES

============================================ */

function parsePositiveInteger(

  value: unknown,

  maximum: number

): number | null {

  if (

    typeof value !== "string" &&

    typeof value !== "number"

  ) {

    return null;

  }

  const raw = String(value).trim();

  if (!/^\d+$/.test(raw)) {

    return null;

  }

  const number = Number(raw);

  if (

    !Number.isSafeInteger(number) ||

    number < 1 ||

    number > maximum

  ) {

    return null;

  }

  return number;

}

function parsePrice(value: unknown, currency = "XOF"): number | null {

  if (typeof value !== "string" && typeof value !== "number") return null;

  const raw = String(value).trim().replace(/\s/g, "").replace(",", ".");

  if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(raw)) return null;

  const [whole, fraction = ""] = raw.split(".");

  const digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;

  if (Number(whole) > MAX_TICKET_PRICE || (fraction.length > digits && /[1-9]/.test(fraction.slice(digits)))) return null;

  const minorUnits = Number(whole) * 10 ** digits + Number(fraction.slice(0, digits).padEnd(digits, "0"));

  return Number.isSafeInteger(minorUnits) ? minorUnits : null;

}

function normalizeCurrency(

  value: unknown

): string | null { if (value === undefined || value === null) return "XOF"; if (typeof value !== "string") return null; const currency = value.trim().toUpperCase(); return isSupportedCurrency(currency) ? currency : null; }

/* ============================================

   VALIDATION DU FUSEAU HORAIRE

============================================ */

function normalizeTimezone(

  value: unknown

): string | null {

  if (typeof value !== "string") {

    return null;

  }

  const timezone = value.trim();

  if (

    timezone.length < 1 ||

    timezone.length > 100

  ) {

    return null;

  }

  try {

    new Intl.DateTimeFormat("en-US", {

      timeZone: timezone,

    });

    return timezone;

  } catch {

    return null;

  }

}

/* ============================================

   VALIDATION DES DATES

============================================ */

function isValidDateString(

  value: string

): boolean {

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {

    return false;

  }

  const [year, month, day] = value

    .split("-")

    .map(Number);

  const date = new Date(

    Date.UTC(year, month - 1, day)

  );

  return (

    date.getUTCFullYear() === year &&

    date.getUTCMonth() === month - 1 &&

    date.getUTCDate() === day

  );

}

function isValidTimeString(

  value: string

): boolean {

  if (!/^\d{2}:\d{2}$/.test(value)) {

    return false;

  }

  const [hours, minutes] = value

    .split(":")

    .map(Number);

  return (

    hours >= 0 &&

    hours <= 23 &&

    minutes >= 0 &&

    minutes <= 59

  );

}

/* ============================================

   CONVERSION DE LA DATE LOCALE EN UTC

   L'organisateur sélectionne une date

   et une heure locales.

   Le serveur utilise le fuseau déclaré

   pour enregistrer la date en UTC.

   Les heures locales inexistantes lors

   d'un changement d'heure sont refusées.

============================================ */

function getLocalParts(

  date: Date,

  timezone: string

) {

  const formatter = new Intl.DateTimeFormat(

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

  );

  const parts = formatter.formatToParts(date);

  const get = (type: string) =>

    Number(

      parts.find((part) => part.type === type)

        ?.value ?? NaN

    );

  return {

    year: get("year"),

    month: get("month"),

    day: get("day"),

    hour: get("hour"),

    minute: get("minute"),

  };

}

function toUTCDate(

  dateString: string,

  timeString: string,

  timezone: string

): Date | null {

  if (

    !isValidDateString(dateString) ||

    !isValidTimeString(timeString)

  ) {

    return null;

  }

  const [year, month, day] = dateString

    .split("-")

    .map(Number);

  const [hour, minute] = timeString

    .split(":")

    .map(Number);

  const wantedUTC = Date.UTC(

    year,

    month - 1,

    day,

    hour,

    minute

  );

  let candidate = wantedUTC;

  for (let attempt = 0; attempt < 4; attempt++) {

    const local = getLocalParts(

      new Date(candidate),

      timezone

    );

    const localAsUTC = Date.UTC(

      local.year,

      local.month - 1,

      local.day,

      local.hour,

      local.minute

    );

    const difference =

      wantedUTC - localAsUTC;

    if (difference === 0) {

      break;

    }

    candidate += difference;

  }

  const result = new Date(candidate);

  const verification = getLocalParts(

    result,

    timezone

  );

  if (

    verification.year !== year ||

    verification.month !== month ||

    verification.day !== day ||

    verification.hour !== hour ||

    verification.minute !== minute

  ) {

    return null;

  }

  return result;

}

/* ============================================

   TYPE DE PÉRIODE

============================================ */

function parseScheduleType(

  value: unknown

): ScheduleType | null {

  if (

    value === "SINGLE_DATE" ||

    value === "DATE_RANGE" ||

    value === "CONTINUOUS"

  ) {

    return value;

  }

  return null;

}

/* ============================================

   CATÉGORIES DE BILLETS

============================================ */

function parseTicketCategories(

  value: unknown,

  currency = "XOF"

): TicketInput[] | null {

  if (

    !Array.isArray(value) ||

    value.length < 1 ||

    value.length > MAX_TICKET_CATEGORIES

  ) {

    return null;

  }

  const result: TicketInput[] = [];

  const usedNames = new Set<string>();

  for (const entry of value) {

    if (

      typeof entry !== "object" ||

      entry === null ||

      Array.isArray(entry)

    ) {

      return null;

    }

    const item = entry as InputRecord;

    const name = normalizeText(

      item.name,

      80

    );

    const price = parsePrice(item.price, currency);

    const quantity = parsePositiveInteger(

      item.quantity,

      MAX_CAPACITY

    );

    if (

      !name ||

      price === null ||

      quantity === null

    ) {

      return null;

    }

    const normalizedName = name

      .normalize("NFD")

      .replace(/[\u0300-\u036f]/g, "")

      .toLowerCase();

    if (usedNames.has(normalizedName)) {

      return null;

    }

    usedNames.add(normalizedName);

    result.push({

      name,

      price,

      quantity,

    });

  }

  return result;

}

/* ============================================

   IDENTIFIANTS DES IMAGES

============================================ */

function isValidImageId(

  value: unknown

): value is string {

  return (

    typeof value === "string" &&

    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(

      value

    )

  );

}

function parseImages(

  value: unknown

): ImageInput[] | null {

  if (

    !Array.isArray(value) ||

    value.length < 1 ||

    value.length > MAX_IMAGES

  ) {

    return null;

  }

  const result: ImageInput[] = [];

  const seen = new Set<string>();

  for (const entry of value) {

    let id: unknown = entry;

    if (

      typeof entry === "object" &&

      entry !== null &&

      !Array.isArray(entry)

    ) {

      id = (entry as InputRecord).id;

    }

    if (!isValidImageId(id)) {

      return null;

    }

    const normalizedId = id.toLowerCase();

    if (seen.has(normalizedId)) {

      return null;

    }

    seen.add(normalizedId);

    result.push({

      id: normalizedId,

    });

  }

  return result;

}

/* ============================================

   VÉRIFICATION DU STOCKAGE DES IMAGES

   Même organisation que :

   /api/organizer/events/images

   Les images appartiennent à l'utilisateur

   ayant effectué leur téléversement.

============================================ */

const STORAGE_BUCKET = process.env.SUPABASE_EVENT_BUCKET || "event-images";

let storageClient: ReturnType<typeof createClient> | undefined;

function getBucket() {

  if (!storageClient) {

    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) throw new Error("SUPABASE_STORAGE_NOT_CONFIGURED");

    storageClient = createClient(url, key, {

      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },

      global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: init?.signal ?? AbortSignal.timeout(30_000) }) },

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

async function imageExists(userId: string, imageId: string): Promise<string | null> {

  return (await findStorageObject(userId, imageId, MAX_IMAGE_BYTES))?.storageKey ?? null;

}

/* ============================================

   IDENTIFIANT D'ÉVÉNEMENT PUBLIC

   Évite les collisions même pour deux

   événements ayant le même nom.

============================================ */

function makeSlug(title: string): string { return titleSlug(title, "evenement"); }

/* ============================================

   SESSION ORGANISATEUR

============================================ */

async function getOrganizer(

  request: NextRequest

): Promise<{

  userId: string;

  organizationId: string;

} | null> {

  const token = request.cookies.get(

    SESSION_COOKIE

  )?.value;

  if (

    !token ||

    !/^[a-f0-9]{64}$/i.test(token)

  ) {

    return null;

  }

  const tokenHash = createHash("sha256")

    .update(token, "utf8")

    .digest("hex");

  const prisma = getPrisma();

  const session = await prisma.session.findFirst({

    where: {

      tokenHash,

      revokedAt: null,

      expiresAt: {

        gt: new Date(),

      },

    },

    select: {

      userId: true,

    },

  });

  if (!session) {

    return null;

  }

  const user = await prisma.user.findUnique({

    where: {

      id: session.userId,

    },

    select: {

      id: true,

      isActive: true,

      isBlocked: true,

      emailVerifiedAt: true,

      roles: {

        where: {

          role: "ORGANIZER",

        },

        select: {

          id: true,

        },

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

  // La création de l'organisation est

  // effectuée lors de l'inscription.

  const organization =

    await prisma.organization.findFirst({

      where: {

        ownerId: user.id,

        isActive: true,

      },

      select: {

        id: true,

      },

    });

  if (!organization) {

    return null;

  }

  return {

    userId: user.id,

    organizationId: organization.id,

  };

}

/* ============================================

   VALIDATION DU FORMULAIRE

============================================ */

function validateEventInput(

  body: InputRecord

):

  | {

      success: true;

      value: EventInput;

    }

  | {

      success: false;

      error: MessageKey;

    } {

  const fail = (error: MessageKey) => ({

    success: false as const,

    error,

  });

  const title = normalizeText(

    body.title,

    180,

    3

  );

  if (!title) {

    return fail("invalidTitle");

  }

  const description = normalizeText(

    body.description,

    2000,

    10

  );

  if (!description) {

    return fail("invalidDescription");

  }

  const category = normalizeCategory(

    body.category

  );

  if (!category) {

    return fail("invalidCategory");

  }

  const countryCode = normalizeCountry(

    body.countryCode

  );

  if (!countryCode) {

    return fail("invalidCountry");

  }

  const city = normalizeText(

    body.city,

    120

  );

  if (!city) {

    return fail("invalidCity");

  }

  const address = normalizeText(

    body.address,

    250

  );

  if (!address) {

    return fail("invalidAddress");

  }

  const venueName =

    body.venueName === undefined ||

    body.venueName === null ||

    body.venueName === ""

      ? address

      : normalizeText(

          body.venueName,

          250

        );

  if (!venueName) {

    return fail("invalidAddress");

  }

  const timezone = normalizeTimezone(

    body.timezone

  );

  if (!timezone) {

    return fail("invalidTimezone");

  }

  const currency = normalizeCurrency(

    body.currency

  );

  if (!currency) {

    return fail("invalidCurrency");

  }

  const capacity = parsePositiveInteger(

    body.capacity,

    MAX_CAPACITY

  );

  if (capacity === null) {

    return fail("invalidCapacity");

  }

  const scheduleType = parseScheduleType(

    body.scheduleType

  );

  if (!scheduleType) {

    return fail("invalidPeriod");

  }

  if (

    typeof body.startDate !== "string" ||

    typeof body.startTime !== "string"

  ) {

    return fail("invalidDate");

  }

  const startsAt = toUTCDate(

    body.startDate,

    body.startTime,

    timezone

  );

  if (!startsAt) {

    return fail("invalidDate");

  }

  if (startsAt <= new Date()) {

    return fail("pastDate");

  }

  let endsAt: Date | null = null;

  if (

    scheduleType === "DATE_RANGE" ||

    (

      scheduleType === "CONTINUOUS" &&

      typeof body.endDate === "string" &&

      body.endDate.length > 0

    )

  ) {

    if (

      typeof body.endDate !== "string"

    ) {

      return fail("invalidDate");

    }

    const endTime =

      typeof body.endTime === "string" &&

      body.endTime.trim().length > 0

        ? body.endTime

        : "23:59";

    endsAt = toUTCDate(

      body.endDate,

      endTime,

      timezone

    );

    if (

      !endsAt ||

      endsAt <= startsAt

    ) {

      return fail("invalidPeriod");

    }

  }

  const tickets = parseTicketCategories(

    body.ticketCategories, currency

  );

  if (!tickets) {

    return fail("invalidTickets");

  }

  const ticketsTotal = tickets.reduce(

    (sum, ticket) => sum + ticket.quantity,

    0

  );

  if (ticketsTotal !== capacity) {

    return fail("capacityMismatch");

  }

  const images = parseImages(

    body.images

  );

  if (!images) {

    return fail("invalidImages");

  }

  return {

    success: true,

    value: {

      title,

      description,

      category,

      countryCode,

      city,

      address,

      venueName,

      timezone,

      currency,

      capacity,

      scheduleType,

      startsAt,

      endsAt,

      tickets,

      images,

    },

  };

}

/* ============================================

   POST — PUBLIER UN ÉVÉNEMENT

============================================ */

/*
 * TIKEMIA — src/app/api/organizer/events/route.ts
 * GET  : liste, statistiques réelles, filtres, pagination.
 * POST : publication sécurisée existante (Supabase Storage, Prisma 7).
 * Requêtes authentifiées, aucune donnée fictive.
 */

export async function POST(

  request: NextRequest

) {

  let language: Language = "fr";

  try {

    /* ----------------------------------------

       1. VÉRIFIER L'ORIGINE

    ---------------------------------------- */

    if (!isAllowedOrigin(request)) {

      return errorResponse(

        language,

        "forbidden",

        403

      );

    }

    /* ----------------------------------------

       2. AUTHENTIFICATION

    ---------------------------------------- */

    const organizer = await getOrganizer(

      request

    );

    if (!organizer) {

      return errorResponse(

        language,

        "unauthorized",

        401

      );

    }

    /* ----------------------------------------

       3. VÉRIFIER LE CONTENT-TYPE

    ---------------------------------------- */

    const contentType =

      request.headers.get("content-type") ?? "";

    if (

      !contentType

        .toLowerCase()

        .startsWith("application/json")

    ) {

      return errorResponse(

        language,

        "invalidRequest",

        415

      );

    }

    /* ----------------------------------------

       4. CONTRÔLER LA TAILLE

    ---------------------------------------- */

    const lengthHeader =

      request.headers.get("content-length");

    if (lengthHeader !== null) {

      const length = Number(lengthHeader);

      if (

        !Number.isFinite(length) ||

        length < 0 ||

        length > MAX_BODY_BYTES

      ) {

        return errorResponse(

          language,

          "tooLarge",

          413

        );

      }

    }

    let received = 0;

    const limitedBody = request.body?.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({

      transform(chunk, controller) {

        received += chunk.byteLength;

        if (received > MAX_BODY_BYTES) throw new Error("REQUEST_TOO_LARGE");

        controller.enqueue(chunk);

      },

    }));

    let rawBody: string;

    try { rawBody = await new Response(limitedBody).text(); }

    catch { return errorResponse(language, "tooLarge", 413); }

    if (

      Buffer.byteLength(rawBody, "utf8") >

      MAX_BODY_BYTES

    ) {

      return errorResponse(

        language,

        "tooLarge",

        413

      );

    }

    /* ----------------------------------------

       5. LIRE LE JSON

    ---------------------------------------- */

    let parsed: unknown;

    try {

      parsed = JSON.parse(rawBody);

    } catch {

      return errorResponse(

        language,

        "invalidRequest",

        400

      );

    }

    if (

      typeof parsed !== "object" ||

      parsed === null ||

      Array.isArray(parsed)

    ) {

      return errorResponse(

        language,

        "invalidRequest",

        400

      );

    }

    const body = parsed as InputRecord;

    language = resolveLanguage(

      body.locale

    );

    /* ----------------------------------------

       6. VALIDER LES DONNÉES

    ---------------------------------------- */

    const validation = validateEventInput(

      body

    );

    if (!validation.success) {

      return errorResponse(

        language,

        validation.error,

        400

      );

    }

    const event = validation.value;

    const requestId = body.requestId;

    if (requestId !== undefined && !isValidImageId(requestId)) {

      return errorResponse(language, "invalidRequest", 400);

    }

    const slug = typeof requestId === "string"

      ? `event-${createHash("sha256").update(organizer.userId + ":" + requestId).digest("hex")}`

      : makeSlug(event.title);

    /* ----------------------------------------

       7. CONTRÔLER LES IMAGES

       Les images doivent déjà être

       enregistrées dans l'espace privé

       de l'organisateur.

    ---------------------------------------- */

    const checks = await Promise.all(

      event.images.map((image) =>

        imageExists(

          organizer.userId,

          image.id

        )

      )

    );

    if (checks.some((exists) => !exists)) {

      return errorResponse(

        language,

        "missingImages",

        400

      );

    }

    /* ----------------------------------------

       8. ENREGISTRER L'ÉVÉNEMENT

       Transaction Prisma :

       - Event

       - Venue

       - EventSchedule

       - EventImage

       - TicketCategory

       Les relations sont créées ensemble.

    ---------------------------------------- */

    const prisma = getPrisma();

    const savedEvent = await prisma.$transaction(

      async (tx) => {

        if (requestId) {

          await tx.$queryRaw`SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(${slug}))) AS publication_lock`;

          const existing = await findPublication(tx, slug);

          if (existing) return existing;

        }

        // Revalider que l'organisation

        // appartient à l'organisateur.

        const organization =

          await tx.organization.findFirst({

            where: {

              id: organizer.organizationId,

              ownerId: organizer.userId,

              isActive: true,

            },

            select: {

              id: true,

            },

          });

        if (!organization) {

          throw new Error(

            "ORGANIZATION_ACCESS_DENIED"

          );

        }

        const readableSlug = await allocateSlug(tx, event.title);
        const created = await tx.event.create({

          data: {

            organizationId:

              organizer.organizationId,

            createdById:

              organizer.userId,

            title: event.title,

            slug: readableSlug,

            description: event.description,

            category: event.category,

            status: "PUBLISHED",
              publishedAt: new Date(),

            currency: event.currency,

            capacity: event.capacity,

            scheduleKind: event.scheduleType,

            timeZone: event.timezone,

          },

          select: {

            id: true,

            slug: true,

            status: true,

            createdAt: true,

          },

        });
        if (requestId) await tx.appSetting.upsert({ where: { key: "publication:event:" + slug }, create: { key: "publication:event:" + slug, value: { id: created.id } }, update: { value: { id: created.id } } });

        // Requêtes séquentielles dans la même transaction : un seul client PostgreSQL.

        await tx.venue.create({ data: {

          eventId: created.id, name: event.venueName, address: event.address,

          city: event.city, country: event.countryCode,

        } });

        await tx.eventSchedule.create({ data: {

          eventId: created.id, startsAt: event.startsAt, endsAt: event.endsAt,

        } });

        await tx.eventImage.createMany({ data: event.images.map((_, index) => ({

          eventId: created.id,

          storageKey: checks[index]!,

          position: index, isPrimary: index === 0,

        })) });

        await tx.ticketCategory.createMany({ data: event.tickets.map(ticket => ({

          eventId: created.id, name: ticket.name, price: ticket.price,

          currency: event.currency, capacity: ticket.quantity, isActive: true,

        })) });

        return created;

      },

      {

        timeout: 15000,

      }

    );

    /* ----------------------------------------

       9. RÉPONSE

    ---------------------------------------- */

    return respond(

      {

        success: true,

        message: TEXT[language].success,

        event: {

          id: savedEvent.id,

          slug: savedEvent.slug,

          status: savedEvent.status,

          createdAt:

            savedEvent.createdAt.toISOString(),

        },

      },

      201

    );

  } catch {

    console.error(

      "[TIKEMIA] Échec de création d'événement."

    );

    return errorResponse(

      language,

      "unavailable",

      503

    );

  }

}

/* ============================================================
   GET — MES ÉVÉNEMENTS (PC et mobile)

   Exemple :
   GET /api/organizer/events?page=1&pageSize=10&status=all&sort=recent&q=

   La même réponse alimente :
   - les quatre indicateurs de « Mes événements » ;
   - les cartes de progression des événements ;
   - les filtres, le tri et la pagination.

   Statistiques : uniquement les commandes PAID ; les autres
   commandes ne sont pas présentées comme des ventes encaissées.
   Les montants sont des entiers exacts en unités mineures et
   restent séparés par devise.
============================================================ */

type EventListStatus =
  | "all"
  | "PUBLISHED"
  | "PENDING_REVIEW"
  | "DRAFT"
  | "COMPLETED"
  | "CANCELLED"
  | "REJECTED"
  | "SUSPENDED";

type EventListSort = "recent" | "oldest" | "title_asc" | "title_desc";

function boundedInt(value: string | null, fallback: number, max: number): number | null {
  if (value === null || value === "") return fallback;
  if (!/^\d+$/.test(value)) return null;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > max) return null;
  return number;
}

function sumAsBigInt(value: unknown): bigint {
  if (value === null || value === undefined) return 0n;
  if (typeof value === "bigint") return value;
  const representation = String(value);
  if (!/^-?\d+$/.test(representation)) {
    throw new Error("INVALID_MONEY_IN_DATABASE");
  }
  return BigInt(representation);
}

function getListLanguage(request: NextRequest): Language {
  const locale = request.nextUrl.searchParams.get("locale");
  if (locale === "fr" || locale === "en") return locale;
  return request.headers.get("accept-language")?.toLowerCase().startsWith("en")
    ? "en"
    : "fr";
}

async function safeImageUrl(storageKey: string): Promise<string | null> {
  // Bucket privé : URL signée brève, jamais de clé serveur dans le navigateur.
  try {
    const { data, error } = await getBucket().createSignedUrl(storageKey, 300);
    return error ? null : data.signedUrl;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const language = getListLanguage(request);

  try {
    const organizer = await getOrganizer(request);
    if (!organizer) {
      return errorResponse(language, "unauthorized", 401);
    }

    const params = request.nextUrl.searchParams;
    const page = boundedInt(params.get("page"), 1, 100000);
    const pageSize = boundedInt(
      params.get("pageSize") ?? params.get("limit"),
      10,
      50
    );
    if (page === null || pageSize === null) {
      return respond({ success: false, message: "Pagination invalide." }, 400);
    }

    const q = (params.get("q") ?? params.get("search") ?? "").trim();
    if (q.length > 120) {
      return respond({ success: false, message: "Recherche trop longue." }, 400);
    }

    const requestedStatus = params.get("status") ?? "all";
    const validStatuses = new Set<EventListStatus>([
      "all", "PUBLISHED", "PENDING_REVIEW", "DRAFT",
      "COMPLETED", "CANCELLED", "REJECTED", "SUSPENDED",
    ]);
    const status = requestedStatus.toUpperCase() === "ALL"
      ? "all"
      : requestedStatus.toUpperCase() as EventListStatus;
    if (!validStatuses.has(status)) {
      return respond({ success: false, message: "Statut invalide." }, 400);
    }

    const sort = (params.get("sort") ?? "recent") as EventListSort;
    if (!["recent", "oldest", "title_asc", "title_desc"].includes(sort)) {
      return respond({ success: false, message: "Tri invalide." }, 400);
    }

    const selectedCurrency = params.get("currency")?.toUpperCase() ?? null;
    if (selectedCurrency && !isSupportedCurrency(selectedCurrency)) {
      return respond({ success: false, message: "Devise invalide." }, 400);
    }

    const prisma = getPrisma();
    // Toujours limiter à l'organisation de la session, jamais un ID client.
    const scope = { organizationId: organizer.organizationId };
    const where = {
      ...scope,
      ...(status !== "all" ? { status: status as "PUBLISHED" } : {}),
      ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
    };

    const orderBy = sort === "oldest"
      ? { createdAt: "asc" as const }
      : sort === "title_asc"
        ? { title: "asc" as const }
        : sort === "title_desc"
          ? { title: "desc" as const }
          : { createdAt: "desc" as const };

    // Valeurs totales indépendantes des filtres de liste.
    const [total, events, publishedCount, finishedCount, pageTotal] = await Promise.all([
      prisma.event.count({ where: scope }),
      prisma.event.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          category: true,
          status: true,
          currency: true,
          capacity: true,
          createdAt: true,
          updatedAt: true,
          venue: {
            select: { name: true, address: true, city: true, country: true },
          },
          schedules: {
            orderBy: { startsAt: "asc" },
            take: 1,
            select: { startsAt: true, endsAt: true },
          },
          images: {
            orderBy: { position: "asc" },
            take: 1,
            select: { storageKey: true },
          },
        },
      }),
      prisma.event.count({ where: { ...scope, status: "PUBLISHED" } }),
      prisma.event.count({ where: { ...scope, status: "COMPLETED" } }),
      prisma.event.count({ where }),
    ]);

    const eventIds = events.map((event) => event.id);

    // Ventes par événement pour la page uniquement, agrégées côté PostgreSQL.
    const pageSales = eventIds.length
      ? await prisma.orderLine.groupBy({
          by: ["eventId"],
          where: {
            eventId: { in: eventIds },
            order: { status: "PAID", paidAt: { not: null } },
          },
          _sum: { quantity: true, subtotal: true },
          _count: { _all: true },
        })
      : [];

    const salesMap = new Map(
      pageSales.map((row) => [
        row.eventId,
        {
          quantity: row._sum.quantity ?? 0,
          amount: sumAsBigInt(row._sum.subtotal),
          lineCount: row._count._all,
        },
      ])
    );

    // Les indicateurs financiers couvrent TOUS les événements de
    // l'organisateur, et non seulement la page sélectionnée.
    const financialTotals = await prisma.orderLine.groupBy({
      by: ["currency"],
      where: {
        event: { organizationId: organizer.organizationId },
        order: { status: "PAID", paidAt: { not: null } },
      },
      _sum: { quantity: true, subtotal: true },
    });

    let totalTicketsSold = 0;
    const turnoverByCurrency: Record<string, string> = {};
    for (const row of financialTotals) {
      totalTicketsSold += row._sum.quantity ?? 0;
      turnoverByCurrency[row.currency] = sumAsBigInt(
        row._sum.subtotal
      ).toString();
    }

    // Éviter les fausses sommes entre devises différentes.
    const currency = selectedCurrency ??
      (Object.keys(turnoverByCurrency).length === 1
        ? Object.keys(turnoverByCurrency)[0]
        : null);

    const serializedEvents = await Promise.all(
      events.map(async (event) => {
        const sold = salesMap.get(event.id)?.quantity ?? 0;
        const remaining = Math.max(0, event.capacity - sold);
        const percentSold = event.capacity > 0
          ? Math.min(100, Math.round((sold / event.capacity) * 100))
          : 0;

        const imageStorageKey = event.images[0]?.storageKey ?? null;
        let imageUrl: string | null = null;
        if (imageStorageKey) {
          imageUrl = await safeImageUrl(imageStorageKey);
        }

        return {
          id: event.id,
          slug: event.slug,
          title: event.title,
          description: event.description,
          category: event.category,
          status: event.status,
          currency: event.currency,
          capacity: event.capacity,
          ticketsSold: sold,
          remainingSeats: remaining,
          ticketsRemaining: remaining,
          progressPercent: percentSold,
          percentageSold: percentSold,
          grossRevenue: (salesMap.get(event.id)?.amount ?? 0n).toString(),
          imageUrl,
          venue: event.venue?.name ?? null,
          address: event.venue?.address ?? null,
          city: event.venue?.city ?? null,
          countryCode: event.venue?.country ?? null,
          startsAt: event.schedules[0]?.startsAt.toISOString() ?? null,
          endsAt: event.schedules[0]?.endsAt?.toISOString() ?? null,
          createdAt: event.createdAt.toISOString(),
          updatedAt: event.updatedAt.toISOString(),
        };
      })
    );

    return respond({
      success: true,
      events: serializedEvents,
      stats: {
        ticketsSold: totalTicketsSold,
        revenue: currency ? (turnoverByCurrency[currency] ?? "0") : null,
        currency,
        revenueByCurrency: turnoverByCurrency,
        eventsOnSale: publishedCount,
        completedEvents: finishedCount,
        totalEvents: total,
      },
      pagination: {
        page,
        pageSize,
        total: pageTotal,
        totalPages: Math.ceil(pageTotal / pageSize),
        hasNextPage: page * pageSize < pageTotal,
        hasPreviousPage: page > 1,
      },
      filters: { q, status, sort, currency: selectedCurrency },
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[TIKEMIA EVENTS GET]", error instanceof Error ? error.message : error);
    return errorResponse(language, "unavailable", 503);
  }
}

async function findPublication(database: PrismaClient | Prisma.TransactionClient, technicalKey: string) {
  const alias = await database.appSetting.findUnique({ where: { key: "publication:event:" + technicalKey }, select: { value: true } });
  const value = alias?.value;
  const id = value && typeof value === "object" && !Array.isArray(value) && typeof value.id === "string" ? value.id : null;
  return database.event.findUnique({ where: id ? { id } : { slug: technicalKey }, select: { id: true, slug: true, status: true, createdAt: true } });
}
async function allocateSlug(tx: Prisma.TransactionClient, title: string): Promise<string> {
  const base = makeSlug(title);
  await tx.$queryRaw`SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(${"event:" + base}))) AS title_lock`;
  let candidate = base;
  for (let suffix = 2; await tx.event.findUnique({ where: { slug: candidate }, select: { id: true } }); suffix++) candidate = base + "-" + suffix;
  return candidate;
}
