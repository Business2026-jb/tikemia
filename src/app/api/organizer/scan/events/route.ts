import { unstable_rethrow } from "next/navigation";

import "server-only";

import { createHash } from "node:crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getPlatformPrisma,
} from "@/lib/payments/fulfillment";

/**
 * ============================================================
 * TIKEMIA — ÉVÉNEMENTS AUTORISÉS AU SCANNER
 * ============================================================
 *
 * Fichier :
 * src/app/api/organizer/scan/events/route.ts
 *
 * Endpoint :
 * GET /api/organizer/scan/events
 *
 * Fonctionnement :
 *
 * 1. Vérifier la session de l'utilisateur.
 * 2. Vérifier que son compte est actif.
 * 3. Récupérer ses événements autorisés.
 * 4. Retourner uniquement les données utiles.
 * 5. Permettre la sélection de l'événement.
 *
 * Accès autorisé :
 *
 * - Propriétaire d'une organisation active.
 * - Membre actif d'une organisation active.
 * - Agent de scan actif affecté à l'événement.
 *
 * Sécurité :
 *
 * - Authentification PostgreSQL.
 * - Aucun userId fourni par le navigateur.
 * - Aucune donnée privée de billet exposée.
 * - Aucune liste de tickets téléchargée.
 * - Aucune mise en cache HTTP.
 * - Pagination pour les grands comptes.
 *
 * Compatible :
 *
 * Next.js App Router
 * Prisma 7 / PostgreSQL
 * TypeScript
 * Français / Anglais
 * Android / iPhone / PC
 *
 * Aucun nouveau modèle Prisma.
 * Aucune nouvelle dépendance.
 *
 * ============================================================
 */



/* ============================================================
   CONFIGURATION
============================================================ */

const SESSION_COOKIE_NAME =
  process.env.TIKEMIA_SESSION_COOKIE_NAME ||
  "tikemia_organizer_session";

const DEFAULT_LIMIT = 50;

const MAX_LIMIT = 100;

const MAX_SEARCH_LENGTH = 100;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const RESPONSE_HEADERS = {
  "Cache-Control":
    "private, no-store, no-cache, must-revalidate",

  Pragma: "no-cache",

  Expires: "0",

  "X-Content-Type-Options": "nosniff",

  "Referrer-Policy": "no-referrer",

  Vary: "Cookie, Accept-Language",
} as const;

/* ============================================================
   TYPES
============================================================ */

type Locale = "fr" | "en";

type AuthenticatedScanner = {
  id: string;
};

type EventListQuery = {
  search: string;
  limit: number;
  cursor: string | null;
};

type ScannerEvent = {
  id: string;
  title: string;
  slug: string;
  category: string;
  status: "PUBLISHED";

  organization: {
    id: string;
    name: string;
  };

  timeZone: string;
  currency: string;
  capacity: number;

  schedule: {
    startsAt: string;
    endsAt: string | null;
  } | null;

  venue: {
    name: string;
    address: string;
    city: string;
    country: string;
  } | null;

  scanUrl: string;
  coverUrl: string | null;
};

type ApiErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_QUERY"
  | "INVALID_CURSOR"
  | "DATABASE_UNAVAILABLE"
  | "INTERNAL_ERROR";

/* ============================================================
   RÉPONSES HTTP
============================================================ */

function json(
  body: Record<string, unknown>,
  status = 200,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: RESPONSE_HEADERS,
  });
}

function fail(
  code: ApiErrorCode,
  status: number,
  locale: Locale,
): NextResponse {
  const messages: Record<
    ApiErrorCode,
    { fr: string; en: string }
  > = {
    UNAUTHORIZED: {
      fr: "Votre session a expiré. Veuillez vous reconnecter.",
      en: "Your session has expired. Please sign in again.",
    },

    INVALID_QUERY: {
      fr: "Les paramètres de recherche sont invalides.",
      en: "The search parameters are invalid.",
    },

    INVALID_CURSOR: {
      fr: "Le paramètre de pagination est invalide.",
      en: "The pagination parameter is invalid.",
    },

    DATABASE_UNAVAILABLE: {
      fr: "Impossible de charger les événements actuellement.",
      en: "Unable to load events at the moment.",
    },

    INTERNAL_ERROR: {
      fr: "Une erreur est survenue lors du chargement des événements.",
      en: "An error occurred while loading events.",
    },
  };

  return json(
    {
      success: false,
      code,
      message: messages[code][locale],
      events: [],
    },
    status,
  );
}

/* ============================================================
   LANGUE
============================================================ */

function getLocale(
  request: NextRequest,
): Locale {
  const language = (
    request.headers.get("accept-language") || ""
  ).toLowerCase();

  return language.startsWith("en")
    ? "en"
    : "fr";
}

/* ============================================================
   UTILITAIRES
============================================================ */

function isUuid(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    UUID_PATTERN.test(value)
  );
}

/* ============================================================
   AUTHENTIFICATION
============================================================ */

/**
 * Même mécanisme que verify/route.ts.
 *
 * Cookie :
 * tikemia_organizer_session
 *
 * PostgreSQL :
 * Session.tokenHash = SHA256(token brut)
 *
 * L'utilisateur doit avoir :
 * - Une session non expirée
 * - Une session non révoquée
 * - Un compte actif
 * - Un compte non bloqué
 *
 * L'autorisation sur les événements
 * est ensuite contrôlée dans la requête
 * PostgreSQL.
 */
async function authenticateScanner(
  request: NextRequest,
): Promise<AuthenticatedScanner | null> {
  const token =
    request.cookies.get(
      SESSION_COOKIE_NAME
    )?.value;

  if (
    !token ||
    token.length < 32 ||
    token.length > 1024
  ) {
    return null;
  }

  const tokenHash = createHash("sha256")
    .update(token, "utf8")
    .digest("hex");

  const prisma = getPlatformPrisma();

  const session = await prisma.session.findUnique({
    where: {
      tokenHash,
    },

    select: {
      expiresAt: true,
      revokedAt: true,

      user: {
        select: {
          id: true,
          isActive: true,
          isBlocked: true,
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  const now = new Date();

  if (
    session.revokedAt !== null ||
    session.expiresAt <= now
  ) {
    return null;
  }

  if (
    !session.user.isActive ||
    session.user.isBlocked
  ) {
    return null;
  }

  return {
    id: session.user.id,
  };
}

/* ============================================================
   PARAMÈTRES DE RECHERCHE
============================================================ */

/**
 * Paramètres supportés :
 *
 * ?search=concert
 * ?limit=50
 * ?cursor=UUID
 *
 * Pagination par identifiant :
 * - Stable
 * - Sans OFFSET important
 * - Adaptée aux grands comptes
 */
function parseQuery(
  request: NextRequest,
): EventListQuery {
  const params = request.nextUrl.searchParams;

  const rawSearch = params.get("search") ?? "";
  const search = rawSearch.trim();

  if (search.length > MAX_SEARCH_LENGTH) {
    throw new Error("INVALID_QUERY");
  }

  const rawLimit = params.get("limit");

  let limit = DEFAULT_LIMIT;

  if (rawLimit !== null) {
    if (!/^\d+$/.test(rawLimit)) {
      throw new Error("INVALID_QUERY");
    }

    const parsed = Number(rawLimit);

    if (
      !Number.isSafeInteger(parsed) ||
      parsed < 1
    ) {
      throw new Error("INVALID_QUERY");
    }

    limit = Math.min(parsed, MAX_LIMIT);
  }

  const rawCursor = params.get("cursor");

  if (
    rawCursor !== null &&
    !isUuid(rawCursor)
  ) {
    throw new Error("INVALID_CURSOR");
  }

  return {
    search,
    limit,
    cursor: rawCursor,
  };
}

/* ============================================================
   RÉCUPÉRATION DES ÉVÉNEMENTS
============================================================ */

/**
 * La requête vérifie directement dans
 * PostgreSQL les permissions de l'utilisateur.
 *
 * Propriétaire :
 * organization.ownerId
 *
 * Membre :
 * organization.members.some(...)
 *
 * Agent de scan :
 * event.scanAgents.some(...)
 *
 * Un agent expiré ou désactivé
 * ne voit plus l'événement.
 *
 * Les organisations désactivées
 * sont exclues.
 *
 * Le filtre PUBLISHED est cohérent
 * avec le moteur scanner.ts actuel.
 */
async function getAuthorizedEvents(
  userId: string,
  query: EventListQuery,
): Promise<{
  events: ScannerEvent[];
  hasMore: boolean;
  nextCursor: string | null;
}> {
  const prisma = getPlatformPrisma();

  const now = new Date();

  const rows = await prisma.event.findMany({
    where: {
      status: "PUBLISHED",

      organization: {
        is: {
          isActive: true,
        },
      },

      OR: [
        /**
         * Propriétaire de l'organisation.
         */
        {
          organization: {
            is: {
              ownerId: userId,
            },
          },
        },

        /**
         * Membre actif de l'organisation.
         */
        {
          organization: {
            is: {
              members: {
                some: {
                  userId,
                  isActive: true,
                },
              },
            },
          },
        },

        /**
         * Agent explicitement affecté.
         */
        {
          scanAgents: {
            some: {
              userId,
              isActive: true,

              OR: [
                {
                  expiresAt: null,
                },
                {
                  expiresAt: {
                    gt: now,
                  },
                },
              ],
            },
          },
        },
      ],

      /**
       * Recherche facultative par titre.
       */
      ...(query.search
        ? {
            title: {
              contains: query.search,
              mode: "insensitive" as const,
            },
          }
        : {}),

      /**
       * Pagination sans OFFSET.
       */
      ...(query.cursor
        ? {
            id: {
              gt: query.cursor,
            },
          }
        : {}),
    },

    /**
     * Ordre stable.
     */
    orderBy: {
      id: "asc",
    },

    /**
     * Une ligne supplémentaire permet
     * de savoir si une autre page existe.
     */
    take: query.limit + 1,

    /**
     * Sélection volontairement limitée.
     *
     * Aucun chargement de :
     * - Ticket[]
     * - TicketScan[]
     * - Order[]
     * - Données de paiement
     * - Données personnelles clients
     */
    select: {
      id: true,
      title: true,
      slug: true,
      category: true,
      status: true,

      timeZone: true,
      currency: true,
      capacity: true,

      organization: {
        select: {
          id: true,
          name: true,
        },
      },

      venue: {
        select: {
          name: true,
          address: true,
          city: true,
          country: true,
        },
      },

      images: { orderBy: { position: "asc" }, take: 1, select: { id: true } },
      schedules: {
        orderBy: {
          startsAt: "asc",
        },

        take: 1,

        select: {
          startsAt: true,
          endsAt: true,
        },
      },
    },
  });

  const hasMore = rows.length > query.limit;

  const selectedRows = hasMore
    ? rows.slice(0, query.limit)
    : rows;

  const events: ScannerEvent[] =
    selectedRows.map((event) => {
      const firstSchedule =
        event.schedules[0] ?? null;

      return {
        id: event.id,
        title: event.title,
        slug: event.slug,
        category: event.category,
        status: "PUBLISHED",

        organization: {
          id: event.organization.id,
          name: event.organization.name,
        },

        timeZone: event.timeZone,
        currency: event.currency,
        capacity: event.capacity,

        schedule: firstSchedule
          ? {
              startsAt:
                firstSchedule.startsAt.toISOString(),

              endsAt:
                firstSchedule.endsAt
                  ? firstSchedule.endsAt.toISOString()
                  : null,
            }
          : null,

        venue: event.venue
          ? {
              name: event.venue.name,
              address: event.venue.address,
              city: event.venue.city,
              country: event.venue.country,
            }
          : null,

        coverUrl: event.images.length ? `/api/organizer/scan/events?imageEventId=${event.id}` : null,
        scanUrl:
          `/organizer/dashboard/scan?eventId=${encodeURIComponent(event.id)}`,
      };
    });

  const nextCursor =
    hasMore && selectedRows.length > 0
      ? selectedRows[selectedRows.length - 1].id
      : null;

  return {
    events,
    hasMore,
    nextCursor,
  };
}

/* ============================================================
   GESTION DES ERREURS
============================================================ */

function handleError(
  error: unknown,
  locale: Locale,
): NextResponse {
  if (error instanceof Error) {
    if (error.message === "INVALID_QUERY") {
      return fail(
        "INVALID_QUERY",
        400,
        locale,
      );
    }

    if (error.message === "INVALID_CURSOR") {
      return fail(
        "INVALID_CURSOR",
        400,
        locale,
      );
    }
  }

  /**
   * Ne pas exposer les requêtes SQL,
   * tokens de session ou informations internes.
   */
  console.error(
    "[TIKEMIA_SCAN_EVENTS]",
    error instanceof Error
      ? error.name
      : "UNKNOWN_ERROR",
  );

  return fail(
    "DATABASE_UNAVAILABLE",
    503,
    locale,
  );
}

/* ============================================================
   GET /api/organizer/scan/events
============================================================ */

export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  const locale = getLocale(request);

  try {
    /* ======================================================
       1. AUTHENTIFICATION
    ====================================================== */

    const user =
      await authenticateScanner(request);

    if (!user) {
      return fail(
        "UNAUTHORIZED",
        401,
        locale,
      );
    }

    /* ======================================================
       2. PARAMÈTRES
    ====================================================== */


    const imageEventId = request.nextUrl.searchParams.get("imageEventId");
    if (imageEventId) {
      if (!isUuid(imageEventId)) return fail("INVALID_QUERY",400,locale);
      const event = await getPlatformPrisma().event.findFirst({
        where: { id:imageEventId, status:"PUBLISHED", organization:{isActive:true},
          OR:[{organization:{ownerId:user.id}},{organization:{members:{some:{userId:user.id,isActive:true}}}},{scanAgents:{some:{userId:user.id,isActive:true,OR:[{expiresAt:null},{expiresAt:{gt:new Date()}}]}}}] },
        select: {images:{orderBy:{position:"asc"},take:1,select:{storageKey:true}}}
      });
      if (!event?.images[0]) return new NextResponse(null,{status:404,headers:RESPONSE_HEADERS});
      const { loadStoredEventImage } = await import("@/lib/tickets/pdf");
      const bytes=await loadStoredEventImage(event.images[0].storageKey);
      if (!bytes) return new NextResponse(null,{status:404,headers:RESPONSE_HEADERS});
      const contentType=bytes[0]===255?"image/jpeg":bytes[0]===137?"image/png":"image/webp";
      return new NextResponse(new Uint8Array(bytes),{headers:{...RESPONSE_HEADERS,"Content-Type":contentType}});
    }

    const query = parseQuery(request);

    /* ======================================================
       3. ÉVÉNEMENTS AUTORISÉS
    ====================================================== */

    const result = await getAuthorizedEvents(
      user.id,
      query,
    );

    /* ======================================================
       4. RÉPONSE
    ====================================================== */

    return json({
      success: true,

      events: result.events,

      pagination: {
        limit: query.limit,
        hasMore: result.hasMore,
        nextCursor: result.nextCursor,
      },

      filters: {
        search: query.search,
      },

      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    unstable_rethrow(error);
    return handleError(error, locale);
  }
}
