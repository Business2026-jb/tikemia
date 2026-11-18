import { createClient } from "@supabase/supabase-js";
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
 * TIKEMIA — ADMINISTRATION / ÉVÉNEMENTS
 * ============================================================
 *
 * FICHIER :
 * src/app/api/admin/events/route.ts
 *
 * ENDPOINT :
 * GET /api/admin/events
 *
 * OBJECTIF :
 * Lire les événements publiés par les organisateurs.
 *
 * FONCTIONNALITÉS :
 *
 * - Authentification ADMIN / SUPER_ADMIN
 * - Lecture PostgreSQL
 * - Nombre total d'événements publiés
 * - Nombre d'organisateurs distincts
 * - Recettes brutes des billets payés
 * - Montants séparés par devise
 * - Recherche
 * - Filtrage par statut
 * - Pagination
 * - Informations complètes des événements
 * - Catégories de billets
 * - Quantités vendues
 * - Dates et lieux
 * - Images
 *
 * Les chiffres proviennent exclusivement
 * des modèles PostgreSQL existants.
 *
 * AUCUNE donnée fictive.
 * AUCUNE modification de Prisma.
 * AUCUNE modification d'événement.
 * AUCUN paiement déclenché.
 *
 * Compatible avec nextConfig.cacheComponents :
 * aucune déclaration dynamic ou revalidate.
 *
 * ============================================================
 */


/* ============================================================
   CONFIGURATION
============================================================ */

const SESSION_COOKIE_NAME =
  "tikemia_admin_session";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const MAX_SEARCH_LENGTH = 100;

const EVENT_STATUSES = [
  "PUBLISHED",
  "SUSPENDED",
  "COMPLETED",
  "CANCELLED",
  "ARCHIVED",
] as const;

type EventStatusFilter =
  (typeof EVENT_STATUSES)[number];

const RESPONSE_HEADERS = {
  "Cache-Control":
    "private, no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  Vary: "Cookie",
} as const;

/* ============================================================
   TYPES
============================================================ */

type AdminIdentity = {
  id: string;
  role: "ADMIN" | "SUPER_ADMIN";
};

type ApiErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_REQUEST"
  | "DATABASE_ERROR";

type EventFilters = {
  page: number;
  pageSize: number;
  search: string;
  status: "ALL" | EventStatusFilter;
};

type CurrencyTotal = {
  currency: string;
  amountMinor: string;
};



type CategoryRevenue = {
  ticketCategoryId: string;
  quantity: number;
  amountMinor: string;
  currency: string;
};

type EventQueryWhere = {
  publishedAt: {
    not: null;
  };

  status?: EventStatusFilter;

  OR?: Array<
    | {
        title: {
          contains: string;
          mode: "insensitive";
        };
      }
    | {
        slug: {
          contains: string;
          mode: "insensitive";
        };
      }
    | {
        category: {
          contains: string;
          mode: "insensitive";
        };
      }
    | {
        organization: {
          is: {
            name: {
              contains: string;
              mode: "insensitive";
            };
          };
        };
      }
  >;
};

/* ============================================================
   RÉPONSES
============================================================ */

function json(
  body: Record<string, unknown>,
  status = 200
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: RESPONSE_HEADERS,
  });
}

function fail(
  code: ApiErrorCode,
  status: number
): NextResponse {
  return json(
    {
      success: false,
      code,
    },
    status
  );
}

/* ============================================================
   AUTHENTIFICATION ADMINISTRATEUR
============================================================ */

/**
 * Même contrat que les routes administrateur
 * de retrait déjà réalisées.
 *
 * Cookie :
 * tikemia_session
 *
 * Session.tokenHash :
 * SHA-256 du jeton brut.
 *
 * Contrôle des rôles :
 * ADMIN / SUPER_ADMIN
 *
 * Le contrat doit rester identique à celui
 * de l'authentification réelle de TIKEMIA.
 */

async function authenticateAdmin(
  request: NextRequest
): Promise<AdminIdentity | null> {
  const token = request.cookies.get(
    SESSION_COOKIE_NAME
  )?.value;

  if (
    !token ||
    !/^[a-f0-9]{64}$/.test(token)
  ) {
    return null;
  }

  const tokenHash = createHash("sha256")
    .update(Buffer.from(token, "hex"))
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

          roles: {
            where: {
              role: {
                in: [
                  "ADMIN",
                  "SUPER_ADMIN",
                ],
              },
            },

            select: {
              role: true,
            },
          },
        },
      },
    },
  });

  if (
    !session ||
    session.revokedAt !== null ||
    session.expiresAt.getTime() <= Date.now()
  ) {
    return null;
  }

  const user = session.user;

  if (
    !user ||
    !user.isActive ||
    user.isBlocked
  ) {
    return null;
  }

  if (
    user.roles.some(
      (item) =>
        item.role === "SUPER_ADMIN"
    )
  ) {
    return {
      id: user.id,
      role: "SUPER_ADMIN",
    };
  }

  if (
    user.roles.some(
      (item) =>
        item.role === "ADMIN"
    )
  ) {
    return {
      id: user.id,
      role: "ADMIN",
    };
  }

  return null;
}

/* ============================================================
   VALIDATION DES PARAMÈTRES
============================================================ */

function parsePositiveInteger(
  value: string | null,
  fallback: number,
  maximum: number
): number | null {
  if (value === null) {
    return fallback;
  }

  if (!/^[1-9][0-9]*$/.test(value)) {
    return null;
  }

  const parsed = Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed > maximum
  ) {
    return null;
  }

  return parsed;
}

function isEventStatus(
  value: string
): value is EventStatusFilter {
  return EVENT_STATUSES.some(
    (status) => status === value
  );
}

function parseFilters(
  request: NextRequest
): EventFilters | null {
  const params = request.nextUrl.searchParams;

  const allowed = new Set([
    "page",
    "pageSize",
    "search",
    "status",
  ]);

  for (const key of params.keys()) {
    if (
      !allowed.has(key) ||
      params.getAll(key).length !== 1
    ) {
      return null;
    }
  }

  const page = parsePositiveInteger(
    params.get("page"),
    1,
    1_000_000
  );

  const pageSize = parsePositiveInteger(
    params.get("pageSize"),
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE
  );

  if (
    page === null ||
    pageSize === null
  ) {
    return null;
  }

  const search = (
    params.get("search") || ""
  ).trim();

  if (
    search.length > MAX_SEARCH_LENGTH
  ) {
    return null;
  }

  const rawStatus =
    params.get("status") || "ALL";

  if (
    rawStatus !== "ALL" &&
    !isEventStatus(rawStatus)
  ) {
    return null;
  }

  return {
    page,
    pageSize,
    search,
    status: rawStatus,
  };
}

/* ============================================================
   CONSTRUIRE LA RECHERCHE
============================================================ */

/**
 * Les événements sont considérés comme
 * mis en ligne lorsqu'ils possèdent
 * une date publishedAt.
 *
 * Cela permet également à l'admin de voir
 * les événements suspendus ou terminés
 * après publication.
 *
 * Les brouillons et événements non
 * encore publiés ne sont pas inclus.
 */

function buildEventWhere(
  filters: EventFilters
): EventQueryWhere {
  const where: EventQueryWhere = {
    publishedAt: {
      not: null,
    },
  };

  if (filters.status !== "ALL") {
    where.status = filters.status;
  }

  if (filters.search) {
    const search = filters.search;

    where.OR = [
      {
        title: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        slug: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        category: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        organization: {
          is: {
            name: {
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

/* ============================================================
   CONVERSION DES SOMMES
============================================================ */

/**
 * PostgreSQL stocke les prix et montants
 * dans des colonnes BigInt.
 *
 * Les réponses JSON convertissent les
 * montants en chaînes de caractères.
 *
 * Aucun mélange des devises.
 */

function minorString(
  value: bigint | null | undefined
): string {
  return (
    value ?? 0n
  ).toString();
}

function safeQuantity(
  value: number | null | undefined
): number {
  return value ?? 0;
}

/* ============================================================
   API GET — ÉVÉNEMENTS ADMINISTRATEUR
============================================================ */

export async function GET(
  request: NextRequest
): Promise<NextResponse> {
  try {
    /* --------------------------------------------------------
       1. VÉRIFIER LA SESSION
    -------------------------------------------------------- */

    const admin =
      await authenticateAdmin(request);

    if (!admin) {
      return fail(
        "UNAUTHORIZED",
        401
      );
    }

    /* --------------------------------------------------------
       2. PARAMÈTRES
    -------------------------------------------------------- */

    const filters =
      parseFilters(request);

    if (!filters) {
      return fail(
        "INVALID_REQUEST",
        400
      );
    }

    const prisma =
      getPlatformPrisma();

    /* --------------------------------------------------------
       3. FILTRE DES ÉVÉNEMENTS PUBLIÉS
    -------------------------------------------------------- */

    const publishedWhere = {
      publishedAt: {
        not: null,
      },
    } as const;

    const filteredWhere =
      buildEventWhere(filters);

    const skip =
      (filters.page - 1) *
      filters.pageSize;

    /* --------------------------------------------------------
       4. STATISTIQUES GLOBALES
    -------------------------------------------------------- */

    /**
     * Nombre d'événements :
     *
     * Événements ayant déjà été publiés.
     *
     * Nombre d'organisateurs :
     *
     * Organisations distinctes ayant
     * au moins un événement publié.
     *
     * Recettes :
     *
     * Somme des sous-totaux des lignes
     * des commandes payées.
     *
     * PARTIALLY_REFUNDED est conservé
     * dans le chiffre brut.
     *
     * Les sommes ne déduisent pas les
     * remboursements, ni les frais.
     */

    const [
      totalPublishedEvents,
      totalOrganizers,
      globalRevenue,
      filteredTotal,
      events,
    ] = await Promise.all([
      prisma.event.count({
        where: publishedWhere,
      }),

      prisma.organization.count({
        where: {
          events: {
            some: publishedWhere,
          },
        },
      }),

      prisma.orderLine.groupBy({
        by: [
          "currency",
        ],

        where: {
          event: {
            is: publishedWhere,
          },

          order: {
            is: {
              status: {
                in: [
                  "PAID",
                  "PARTIALLY_REFUNDED",
                ],
              },
            },
          },
        },

        _sum: {
          subtotal: true,
          quantity: true,
        },

        orderBy: {
          currency: "asc",
        },
      }),

      prisma.event.count({
        where: filteredWhere,
      }),

      prisma.event.findMany({
        where: filteredWhere,

        orderBy: [
          {
            publishedAt: "desc",
          },
          {
            createdAt: "desc",
          },
        ],

        skip,
        take: filters.pageSize,

        select: {
          id: true,
          organizationId: true,
          createdById: true,

          title: true,
          slug: true,
          category: true,
          description: true,
          status: true,

          scheduleKind: true,
          ticketValidity: true,

          currency: true,
          timeZone: true,
          capacity: true,

          publishedAt: true,
          createdAt: true,
          updatedAt: true,

          organization: {
            select: {
              id: true,
              name: true,
              email: true,
              phoneE164: true,
              countryCode: true,
              city: true,
              isActive: true,
              blueBadgeEnabled: true,

              owner: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                },
              },
            },
          },

          venue: {
            select: {
              id: true,
              name: true,
              address: true,
              city: true,
              country: true,
              imageKey: true,
            },
          },

          schedules: {
            orderBy: {
              startsAt: "asc",
            },

            select: {
              id: true,
              startsAt: true,
              endsAt: true,
              label: true,
            },
          },

          images: {
            orderBy: [
              {
                position: "asc",
              },
              {
                createdAt: "asc",
              },
            ],

            select: {
              id: true,
              storageKey: true,
              isPrimary: true,
              position: true,
            },
          },

          categories: {
            orderBy: {
              createdAt: "asc",
            },

            select: {
              id: true,
              name: true,
              description: true,
              price: true,
              currency: true,
              capacity: true,
              isActive: true,
            },
          },
        },
      }),
    ]);

    /* --------------------------------------------------------
       5. RECETTES DES ÉVÉNEMENTS DE LA PAGE
    -------------------------------------------------------- */

    /**
     * Les sommes et billets vendus sont
     * calculés pour les événements affichés.
     *
     * Une seule requête groupée est utilisée
     * pour éviter une requête par événement.
     */

    const eventIds =
      events.map(
        (event) => event.id
      );

    const pageRevenue =
      eventIds.length === 0
        ? []
        : await prisma.orderLine.groupBy({
            by: [
              "eventId",
              "ticketCategoryId",
              "currency",
            ],

            where: {
              eventId: {
                in: eventIds,
              },

              order: {
                is: {
                  status: {
                    in: [
                      "PAID",
                      "PARTIALLY_REFUNDED",
                    ],
                  },
                },
              },
            },

            _sum: {
              subtotal: true,
              quantity: true,
            },
          });

    /* --------------------------------------------------------
       6. INDEX DES VENTES
    -------------------------------------------------------- */

    const revenueByEvent =
      new Map<
        string,
        Map<string, {
          amountMinor: bigint;
          ticketsSold: number;
        }>
      >();

    const revenueByCategory =
      new Map<
        string,
        CategoryRevenue
      >();

    for (const row of pageRevenue) {
      const amount =
        row._sum.subtotal ?? 0n;

      const quantity =
        safeQuantity(
          row._sum.quantity
        );

      let currencyMap =
        revenueByEvent.get(
          row.eventId
        );

      if (!currencyMap) {
        currencyMap = new Map();

        revenueByEvent.set(
          row.eventId,
          currencyMap
        );
      }

      const existing =
        currencyMap.get(
          row.currency
        );

      currencyMap.set(
        row.currency,
        {
          amountMinor:
            (existing?.amountMinor ?? 0n) +
            amount,

          ticketsSold:
            (existing?.ticketsSold ?? 0) +
            quantity,
        }
      );

      const categoryKey =
        `${row.eventId}:${row.ticketCategoryId}:${row.currency}`;

      const oldCategory =
        revenueByCategory.get(
          categoryKey
        );

      revenueByCategory.set(
        categoryKey,
        {
          ticketCategoryId:
            row.ticketCategoryId,

          currency:
            row.currency,

          amountMinor: (
            BigInt(
              oldCategory?.amountMinor ??
                "0"
            ) + amount
          ).toString(),

          quantity:
            (oldCategory?.quantity ?? 0) +
            quantity,
        }
      );
    }

    /* --------------------------------------------------------
       7. FORMATER LES ÉVÉNEMENTS
    -------------------------------------------------------- */

    // Deliver private event images through short-lived URLs, including previews.
    const signedImages = new Map<string, string>();
    const imageKeys = [...new Set(events.flatMap(event => event.images.map(image => image.storageKey)))].filter(key => /^[a-zA-Z0-9_/-]+\.(?:jpe?g|png|webp)$/i.test(key) && !key.startsWith("/") && !key.split("/").includes(".."));
    const storageUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const storageKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (imageKeys.length && storageUrl && storageKey) {
      try {
        const storage = createClient(storageUrl, storageKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000), cache: "no-store" }) } });
        const { data } = await storage.storage.from(process.env.SUPABASE_EVENT_BUCKET || "event-images").createSignedUrls(imageKeys, 300);
        for (const item of data ?? []) if (item.path && item.signedUrl && !item.error) signedImages.set(item.path, item.signedUrl);
      } catch { /* Missing images do not prevent administrative consultation. */ }
    }

    const formattedEvents =
      events.map((event) => {
        const eventRevenue =
          revenueByEvent.get(
            event.id
          );

        const revenue: CurrencyTotal[] =
          eventRevenue
            ? Array.from(
                eventRevenue.entries()
              )
                .map(
                  ([currency, value]) => ({
                    currency,
                    amountMinor:
                      value.amountMinor.toString(),
                  })
                )
                .sort(
                  (a, b) =>
                    a.currency.localeCompare(
                      b.currency
                    )
                )
            : [];

        const ticketsSold =
          eventRevenue
            ? Array.from(
                eventRevenue.values()
              ).reduce(
                (total, value) =>
                  total + value.ticketsSold,
                0
              )
            : 0;

        const mainImage =
          event.images.find(
            (image) => image.isPrimary
          ) ??
          event.images[0] ??
          null;

        const firstSchedule =
          event.schedules[0] ??
          null;

        const lastSchedule =
          event.schedules.length > 0
            ? event.schedules[
                event.schedules.length - 1
              ]
            : null;

        return {
          id: event.id,
          organizationId:
            event.organizationId,

          title: event.title,
          slug: event.slug,
          category: event.category,
          description: event.description,

          status: event.status,
          currency: event.currency,

          timeZone: event.timeZone,
          capacity: event.capacity,

          scheduleKind:
            event.scheduleKind,

          ticketValidity:
            event.ticketValidity,

          publishedAt:
            event.publishedAt
              ?.toISOString() ?? null,

          createdAt:
            event.createdAt.toISOString(),

          updatedAt:
            event.updatedAt.toISOString(),

          organizer: {
            id: event.organization.id,
            name: event.organization.name,

            email:
              event.organization.email ??
              event.organization.owner.email,

            phoneE164:
              event.organization.phoneE164,

            countryCode:
              event.organization.countryCode,

            city:
              event.organization.city,

            isActive:
              event.organization.isActive,

            blueBadgeEnabled:
              event.organization
                .blueBadgeEnabled,

            owner: {
              id:
                event.organization.owner.id,

              fullName:
                event.organization.owner.fullName,

              email:
                event.organization.owner.email,
            },
          },

          venue: event.venue
            ? {
                id: event.venue.id,
                name: event.venue.name,
                address: event.venue.address,
                city: event.venue.city,
                country: event.venue.country,
                imageKey:
                  event.venue.imageKey,
              }
            : null,

          startAt:
            firstSchedule
              ?.startsAt.toISOString() ??
            null,

          endAt:
            lastSchedule
              ?.endsAt?.toISOString() ??
            null,

          schedules:
            event.schedules.map(
              (schedule) => ({
                id: schedule.id,

                startsAt:
                  schedule.startsAt.toISOString(),

                endsAt:
                  schedule.endsAt
                    ?.toISOString() ?? null,

                label:
                  schedule.label,
              })
            ),

          mainImageKey:
            (mainImage ? signedImages.get(mainImage.storageKey) ?? mainImage.storageKey : null),

          images:
            event.images.map(
              (image) => ({
                id: image.id,

                storageKey:
                  signedImages.get(image.storageKey) ?? image.storageKey,

                isPrimary:
                  image.isPrimary,

                position:
                  image.position,
              })
            ),

          categories:
            event.categories.map(
              (category) => {
                const categoryKey =
                  `${event.id}:${category.id}:${category.currency}`;

                const sales =
                  revenueByCategory.get(
                    categoryKey
                  );

                return {
                  id: category.id,

                  name: category.name,
                  description:
                    category.description,

                  priceMinor:
                    category.price.toString(),

                  currency:
                    category.currency,

                  capacity:
                    category.capacity,

                  isActive:
                    category.isActive,

                  ticketsSold:
                    sales?.quantity ?? 0,

                  grossRevenueMinor:
                    sales?.amountMinor ??
                    "0",
                };
              }
            ),

          ticketsSold,

          grossRevenue:
            revenue,

          /**
           * Ces montants sont des ventes brutes
           * avant remboursements.
           *
           * Ce n'est pas le montant disponible
           * à retirer par l'organisateur.
           */
          revenueBasis:
            "PAID_AND_PARTIALLY_REFUNDED_GROSS",

          source: "POSTGRESQL",
        };
      });

    /* --------------------------------------------------------
       8. STATISTIQUES DES RECETTES
    -------------------------------------------------------- */

    const revenueTotals:
      CurrencyTotal[] =
      globalRevenue.map(
        (entry) => ({
          currency:
            entry.currency,

          amountMinor:
            minorString(
              entry._sum.subtotal
            ),
        })
      );

    const totalTicketsSold =
      globalRevenue.reduce(
        (total, entry) =>
          total +
          safeQuantity(
            entry._sum.quantity
          ),
        0
      );

    /* --------------------------------------------------------
       9. PAGINATION
    -------------------------------------------------------- */

    const totalPages =
      Math.ceil(
        filteredTotal /
        filters.pageSize
      );

    const pagination = {
      page:
        filters.page,

      pageSize:
        filters.pageSize,

      total:
        filteredTotal,

      totalPages,

      hasNextPage:
        filters.page < totalPages,

      hasPreviousPage:
        filters.page > 1 &&
        totalPages > 0,
    };

    /* --------------------------------------------------------
       10. RÉPONSE POUR LA PAGE ADMIN
    -------------------------------------------------------- */

    return json({
      success: true,

      data: {
        events: formattedEvents,

        summary: {
          totalEvents:
            totalPublishedEvents,

          totalOrganizers:
            totalOrganizers,

          totalTicketsSold,

          grossRevenue:
            revenueTotals,

          revenueBasis:
            "PAID_AND_PARTIALLY_REFUNDED_GROSS",
        },

        pagination,

        filters: {
          page:
            filters.page,

          pageSize:
            filters.pageSize,

          search:
            filters.search,

          status:
            filters.status,
        },

        refreshedAt:
          new Date().toISOString(),
      },
    });
  } catch (error) {
    unstable_rethrow(error);
    console.error(
      "[TIKEMIA_ADMIN_EVENTS_GET]",
      error instanceof Error
        ? error.name
        : "UNKNOWN_ERROR"
    );

    return fail(
      "DATABASE_ERROR",
      503
    );
  }
}

/* ============================================================
   AUTRES MÉTHODES — LECTURE SEULE
============================================================ */

/**
 * Cette page est une page de consultation.
 *
 * Elle ne modifie pas :
 *
 * - Les événements
 * - Les catégories
 * - Les ventes
 * - Les billets
 * - Les paiements
 *
 * Les méthodes d'écriture ne sont
 * pas autorisées sur cet endpoint.
 */

function methodNotAllowed():
  NextResponse {
  return new NextResponse(null, {
    status: 405,

    headers: {
      ...RESPONSE_HEADERS,
      Allow: "GET, HEAD",
    },
  });
}

export async function POST():
  Promise<NextResponse> {
  return methodNotAllowed();
}

export async function PUT():
  Promise<NextResponse> {
  return methodNotAllowed();
}

export async function PATCH():
  Promise<NextResponse> {
  return methodNotAllowed();
}

export async function DELETE():
  Promise<NextResponse> {
  return methodNotAllowed();
}
