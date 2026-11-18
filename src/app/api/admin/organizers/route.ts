import { unstable_rethrow } from "next/navigation";

import "server-only";

import { createHash } from "node:crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { Prisma } from "@/generated/prisma/client";

import {
  getPlatformPrisma,
} from "@/lib/payments/fulfillment";

/**
 * ============================================================
 * TIKEMIA â€” ADMIN / ORGANISATEURS
 * ============================================================
 *
 * Fichier :
 * src/app/api/admin/organizers/route.ts
 *
 * Endpoint :
 * GET /api/admin/organizers
 *
 * FonctionnalitÃ©s :
 *
 * 1. VÃ©rification de la session administrateur.
 * 2. VÃ©rification des rÃ´les ADMIN / SUPER_ADMIN.
 * 3. Liste des organisations enregistrÃ©es.
 * 4. Recherche par nom, email ou tÃ©lÃ©phone.
 * 5. Pagination.
 * 6. Filtrage actif / inactif.
 * 7. Filtrage badge bleu.
 * 8. Nombre total d'Ã©vÃ©nements.
 * 9. Nombre d'Ã©vÃ©nements publiÃ©s.
 * 10. Nombre total de cagnottes.
 * 11. Nombre de cagnottes publiÃ©es.
 * 12. Ventes de billets confirmÃ©es.
 * 13. Dons confirmÃ©s.
 * 14. Chiffre d'affaires par devise.
 * 15. Ã‰tat actuel du badge bleu.
 *
 * IMPORTANT :
 *
 * - Lecture directe dans PostgreSQL.
 * - Aucun montant fictif.
 * - Aucun paiement crÃ©Ã© ou modifiÃ©.
 * - Aucun badge modifiÃ© par GET.
 * - Aucune conversion monÃ©taire inventÃ©e.
 * - Aucun secret exposÃ©.
 * - Aucune nouvelle table requise.
 *
 * Le dÃ©tail et le PATCH sont assurÃ©s par :
 *
 * src/app/api/admin/organizers/[id]/route.ts
 *
 * La page :
 *
 * src/app/admin/organizers/page.tsx
 *
 * utilisera cette API sur mobile et PC.
 * ============================================================
 */


/* ============================================================
   CONFIGURATION
============================================================ */

const DEFAULT_PAGE = 1;

const DEFAULT_PAGE_SIZE = 20;

const MAX_PAGE_SIZE = 50;

const MAX_PAGE_NUMBER = 100000;

const MAX_SEARCH_LENGTH = 100;

const MAX_QUERY_LENGTH = 2048;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;



const ALLOWED_PARAMS = new Set([
  "page",
  "pageSize",
  "search",
  "status",
  "badge",
]);

const SESSION_COOKIE_NAME =
  "tikemia_admin_session";

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

type AdminRole =
  | "ADMIN"
  | "SUPER_ADMIN";

type AdminIdentity = {
  id: string;
  role: AdminRole;
};

type AccountFilter =
  | "all"
  | "active"
  | "inactive";

type BadgeFilter =
  | "all"
  | "enabled"
  | "disabled";

type QueryFilters = {
  page: number;
  pageSize: number;
  search: string;
  status: AccountFilter;
  badge: BadgeFilter;
};

type ApiErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_REQUEST"
  | "DATABASE_ERROR";

type MoneyTotal = {
  currency: string;

  ticketSalesMinor: string;

  donationsMinor: string;

  generatedMinor: string;
};

type OrganizationStatistics = {
  totalEvents: number;
  publishedEvents: number;

  totalCampaigns: number;
  publishedCampaigns: number;

  amountBasis: "CONFIRMED_GROSS";

  totalsByCurrency: MoneyTotal[];
};

type OrganizationListItem = {
  id: string;

  name: string;

  description: string | null;

  logoStorageKey: string | null;

  email: string | null;

  phoneE164: string | null;

  countryCode: string | null;

  city: string | null;

  isActive: boolean;

  blueBadgeEnabled: boolean;

  verificationStatus: string;

  owner: {
    id: string;
    fullName: string;
    email: string;
    phoneE164: string | null;
    avatarStorageKey: string | null;
    isActive: boolean;
    isBlocked: boolean;
  };

  statistics: OrganizationStatistics;

  createdAt: string;
  updatedAt: string;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

type AmountRow = {
  organizationId: string;
  currency: string;
  amountMinor: string;
};



type AggregateValues = {
  ticketSales: bigint;
  donations: bigint;
};

/* ============================================================
   RÃ‰PONSES API
============================================================ */

function json(
  data: Record<string, unknown>,
  status = 200
): NextResponse {
  return NextResponse.json(
    data,
    {
      status,
      headers: RESPONSE_HEADERS,
    }
  );
}

function errorResponse(
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
   UTILITAIRES
============================================================ */

function isUuid(
  value: unknown
): value is string {
  return (
    typeof value === "string" &&
    UUID_PATTERN.test(value)
  );
}



function parsePositiveInteger(
  value: string | null,
  defaultValue: number,
  maximum: number
): number | null {
  if (value === null) {
    return defaultValue;
  }

  if (!/^[1-9][0-9]*$/.test(value)) {
    return null;
  }

  const parsed = Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1 ||
    parsed > maximum
  ) {
    return null;
  }

  return parsed;
}

/* ============================================================
   VALIDATION DES PARAMÃˆTRES
============================================================ */

/**
 * Exemples :
 *
 * /api/admin/organizers
 *
 * /api/admin/organizers?page=2
 *
 * /api/admin/organizers?search=festival
 *
 * /api/admin/organizers?badge=enabled
 *
 * /api/admin/organizers?status=active
 *
 * /api/admin/organizers?page=1&pageSize=20
 *
 * Aucun paramÃ¨tre inconnu n'est acceptÃ©.
 */

function parseFilters(
  request: NextRequest
): QueryFilters | null {
  const params =
    request.nextUrl.searchParams;

  if (
    request.nextUrl.search.length >
    MAX_QUERY_LENGTH
  ) {
    return null;
  }

  for (const key of params.keys()) {
    if (
      !ALLOWED_PARAMS.has(key) ||
      params.getAll(key).length !== 1
    ) {
      return null;
    }
  }

  const page =
    parsePositiveInteger(
      params.get("page"),
      DEFAULT_PAGE,
      MAX_PAGE_NUMBER
    );

  const pageSize =
    parsePositiveInteger(
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

  const search =
    (
      params.get("search") ?? ""
    ).trim();

  if (
    search.length > MAX_SEARCH_LENGTH ||
    /[\x00-\x1F\x7F]/.test(search)
  ) {
    return null;
  }

  const status =
    params.get("status") ?? "all";

  const badge =
    params.get("badge") ?? "all";

  if (
    status !== "all" &&
    status !== "active" &&
    status !== "inactive"
  ) {
    return null;
  }

  if (
    badge !== "all" &&
    badge !== "enabled" &&
    badge !== "disabled"
  ) {
    return null;
  }

  return {
    page,
    pageSize,
    search,
    status,
    badge,
  };
}

/* ============================================================
   AUTHENTIFICATION
============================================================ */

/**
 * CompatibilitÃ© avec :
 *
 * src/app/api/admin/organizers/[id]/route.ts
 *
 * ModÃ¨les Prisma :
 *
 * Session
 * User
 * UserRole
 *
 * VÃ©rifications :
 *
 * - Cookie de session
 * - Empreinte SHA-256
 * - Session existante
 * - Session non expirÃ©e
 * - Session non rÃ©voquÃ©e
 * - Utilisateur actif
 * - Utilisateur non bloquÃ©
 * - RÃ´le ADMIN ou SUPER_ADMIN
 *
 * IMPORTANT :
 *
 * Le systÃ¨me de connexion existant doit
 * stocker SHA-256(token) dans Session.tokenHash.
 *
 * Le cookie doit Ãªtre le mÃªme que celui
 * utilisÃ© dans l'administration actuelle.
 *
 * Aucune identitÃ© admin n'est acceptÃ©e
 * depuis un paramÃ¨tre de requÃªte.
 */

async function authenticateAdmin(
  request: NextRequest
): Promise<AdminIdentity | null> {
  const rawToken =
    request.cookies.get(
      SESSION_COOKIE_NAME
    )?.value;

  if (
    !rawToken ||
    !/^[a-f0-9]{64}$/.test(rawToken)
  ) {
    return null;
  }

  const tokenHash =
    createHash("sha256")
      .update(Buffer.from(rawToken, "hex"))
      .digest("hex");

  const prisma =
    getPlatformPrisma();

  const session =
    await prisma.session.findUnique({
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

  if (!session) {
    return null;
  }

  if (
    session.revokedAt !== null ||
    session.expiresAt.getTime() <=
      Date.now()
  ) {
    return null;
  }

  const user =
    session.user;

  if (
    !user ||
    !user.isActive ||
    user.isBlocked
  ) {
    return null;
  }

  const superAdmin =
    user.roles.some(
      (role) =>
        role.role === "SUPER_ADMIN"
    );

  if (superAdmin) {
    return {
      id: user.id,
      role: "SUPER_ADMIN",
    };
  }

  const admin =
    user.roles.some(
      (role) =>
        role.role === "ADMIN"
    );

  if (!admin) {
    return null;
  }

  return {
    id: user.id,
    role: "ADMIN",
  };
}

/* ============================================================
   CONSTRUCTION DES FILTRES PRISMA
============================================================ */

/**
 * La recherche porte sur :
 *
 * - Nom de l'organisation
 * - Email de l'organisation
 * - TÃ©lÃ©phone de l'organisation
 * - Nom du responsable
 * - Email du responsable
 * - TÃ©lÃ©phone du responsable
 *
 * Le moteur Prisma protÃ¨ge les paramÃ¨tres
 * contre les injections SQL.
 */

function buildWhere(
  filters: QueryFilters
): Prisma.OrganizationWhereInput {
  const where:
    Prisma.OrganizationWhereInput = {};

  if (
    filters.status === "active"
  ) {
    where.isActive = true;
  }

  if (
    filters.status === "inactive"
  ) {
    where.isActive = false;
  }

  if (
    filters.badge === "enabled"
  ) {
    where.blueBadgeEnabled = true;
  }

  if (
    filters.badge === "disabled"
  ) {
    where.blueBadgeEnabled = false;
  }

  if (filters.search) {
    const search =
      filters.search;

    where.OR = [
      {
        name: {
          contains: search,
          mode: "insensitive",
        },
      },

      {
        email: {
          contains: search,
          mode: "insensitive",
        },
      },

      {
        phoneE164: {
          contains: search,
        },
      },

      {
        owner: {
          is: {
            fullName: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
      },

      {
        owner: {
          is: {
            email: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
      },

      {
        owner: {
          is: {
            phoneE164: {
              contains: search,
            },
          },
        },
      },
    ];
  }

  return where;
}

/* ============================================================
   STATISTIQUES PUBLIÃ‰ES
============================================================ */

/**
 * Pour les Ã©vÃ©nements :
 *
 * PUBLISHED
 * COMPLETED
 *
 * avec publishedAt non null.
 *
 * Pour les cagnottes :
 *
 * PUBLISHED
 * CLOSED
 *
 * avec publishedAt non null.
 *
 * Une publication dÃ©jÃ  terminÃ©e reste
 * comptabilisÃ©e comme ayant Ã©tÃ© publiÃ©e.
 *
 * DRAFT, REJECTED, CANCELLED et autres
 * statuts ne sont pas ajoutÃ©s aux nombres
 * de publications.
 */

async function getPublishedCounts(
  organizationIds: string[]
): Promise<{
  events: Map<string, number>;
  campaigns: Map<string, number>;
}> {
  const prisma =
    getPlatformPrisma();

  if (organizationIds.length === 0) {
    return {
      events: new Map(),
      campaigns: new Map(),
    };
  }

  const [
    eventGroups,
    campaignGroups,
  ] = await Promise.all([
    prisma.event.groupBy({
      by: [
        "organizationId",
      ],

      where: {
        organizationId: {
          in: organizationIds,
        },

        status: {
          in: [
            "PUBLISHED",
            "COMPLETED",
          ],
        },

        publishedAt: {
          not: null,
        },
      },

      _count: {
        _all: true,
      },
    }),

    prisma.campaign.groupBy({
      by: [
        "organizationId",
      ],

      where: {
        organizationId: {
          in: organizationIds,
        },

        status: {
          in: [
            "PUBLISHED",
            "CLOSED",
          ],
        },

        publishedAt: {
          not: null,
        },
      },

      _count: {
        _all: true,
      },
    }),
  ]);

  const events =
    new Map<string, number>();

  const campaigns =
    new Map<string, number>();

  for (const group of eventGroups) {
    events.set(
      group.organizationId,
      group._count._all
    );
  }

  for (const group of campaignGroups) {
    campaigns.set(
      group.organizationId,
      group._count._all
    );
  }

  return {
    events,
    campaigns,
  };
}

/* ============================================================
   AGRÃ‰GATION DES VENTES
============================================================ */

/**
 * Calcul des ventes de billets par organisation.
 *
 * Tables :
 *
 * Organization
 * Event
 * OrderLine
 * Order
 *
 * RÃ¨gles :
 *
 * - L'Ã©vÃ©nement appartient Ã  l'organisation.
 * - La commande est PAID.
 * - paidAt existe.
 * - Somme des sous-totaux des lignes.
 * - Frais de service exclus.
 * - Montants sÃ©parÃ©s par devise.
 *
 * IMPORTANT :
 *
 * Ces chiffres reprÃ©sentent les ventes
 * brutes confirmÃ©es.
 *
 * Les remboursements partiels ne sont pas
 * dÃ©duits dans cette version.
 *
 * Ils ne doivent pas Ãªtre prÃ©sentÃ©s
 * comme un solde disponible au retrait.
 *
 * Les requÃªtes utilisent Prisma.sql :
 * les identifiants sont paramÃ©trÃ©s.
 */

async function getTicketSales(
  organizationIds: string[]
): Promise<AmountRow[]> {
  if (organizationIds.length === 0) {
    return [];
  }

  if (
    !organizationIds.every(isUuid)
  ) {
    throw new Error(
      "INVALID_ORGANIZATION_IDS"
    );
  }

  const prisma =
    getPlatformPrisma();

  const ids =
    Prisma.join(
      organizationIds.map(
        (id) =>
          Prisma.sql`${id}::uuid`
      )
    );

  const rows =
    await prisma.$queryRaw<
      AmountRow[]
    >(
      Prisma.sql`
        SELECT
          e."organizationId"::text
            AS "organizationId",

          ol."currency"
            AS "currency",

          COALESCE(
            SUM(ol."subtotal"),
            0
          )::text
            AS "amountMinor"

        FROM "OrderLine" AS ol

        INNER JOIN "Event" AS e
          ON e."id" = ol."eventId"

        INNER JOIN "Order" AS o
          ON o."id" = ol."orderId"

        WHERE
          e."organizationId" IN (${ids})

          AND o."status"::text = 'PAID'

          AND o."paidAt" IS NOT NULL

        GROUP BY
          e."organizationId",
          ol."currency"
      `
    );

  return rows;
}

/* ============================================================
   AGRÃ‰GATION DES DONS
============================================================ */

/**
 * Tables :
 *
 * Campaign
 * Donation
 *
 * RÃ¨gles :
 *
 * - La cagnotte appartient Ã  l'organisation.
 * - Le don est CONFIRMED.
 * - confirmedAt existe.
 * - Les montants sont groupÃ©s par devise.
 *
 * On n'ajoute pas les dons PENDING, FAILED,
 * CANCELLED ou REFUNDED.
 */

async function getConfirmedDonations(
  organizationIds: string[]
): Promise<AmountRow[]> {
  if (organizationIds.length === 0) {
    return [];
  }

  if (
    !organizationIds.every(isUuid)
  ) {
    throw new Error(
      "INVALID_ORGANIZATION_IDS"
    );
  }

  const prisma =
    getPlatformPrisma();

  const ids =
    Prisma.join(
      organizationIds.map(
        (id) =>
          Prisma.sql`${id}::uuid`
      )
    );

  const rows =
    await prisma.$queryRaw<
      AmountRow[]
    >(
      Prisma.sql`
        SELECT
          c."organizationId"::text
            AS "organizationId",

          d."currency"
            AS "currency",

          COALESCE(
            SUM(d."amount"),
            0
          )::text
            AS "amountMinor"

        FROM "Donation" AS d

        INNER JOIN "Campaign" AS c
          ON c."id" = d."campaignId"

        WHERE
          c."organizationId" IN (${ids})

          AND d."status"::text = 'CONFIRMED'

          AND d."confirmedAt" IS NOT NULL

        GROUP BY
          c."organizationId",
          d."currency"
      `
    );

  return rows;
}

/* ============================================================
   PRÃ‰PARATION DES TOTAUX PAR ORGANISATEUR
============================================================ */

/**
 * Les montants restent en BigInt jusqu'Ã 
 * la sÃ©rialisation finale.
 *
 * Exemple :
 *
 * XOF
 * ticketSalesMinor = "500000"
 * donationsMinor   = "100000"
 * generatedMinor   = "600000"
 *
 * EUR est traitÃ© sÃ©parÃ©ment.
 *
 * Aucun mÃ©lange de devises.
 */

function buildTotalsByOrganization(
  organizationIds: string[],

  salesRows: AmountRow[],

  donationRows: AmountRow[]
): Map<string, MoneyTotal[]> {
  const allowedIds =
    new Set(organizationIds);

  const organizations =
    new Map<
      string,
      Map<string, AggregateValues>
    >();

  for (const id of organizationIds) {
    organizations.set(
      id,
      new Map()
    );
  }

  function getValues(
    organizationId: string,
    currency: string
  ): AggregateValues | null {
    if (
      !allowedIds.has(organizationId)
    ) {
      return null;
    }

    const currencies =
      organizations.get(organizationId);

    if (!currencies) {
      return null;
    }

    let values =
      currencies.get(currency);

    if (!values) {
      values = {
        ticketSales: 0n,
        donations: 0n,
      };

      currencies.set(
        currency,
        values
      );
    }

    return values;
  }

  for (const row of salesRows) {
    const values =
      getValues(
        row.organizationId,
        row.currency
      );

    if (!values) {
      continue;
    }

    values.ticketSales +=
      BigInt(row.amountMinor);
  }

  for (const row of donationRows) {
    const values =
      getValues(
        row.organizationId,
        row.currency
      );

    if (!values) {
      continue;
    }

    values.donations +=
      BigInt(row.amountMinor);
  }

  const result =
    new Map<string, MoneyTotal[]>();

  for (
    const [
      organizationId,
      currencies,
    ] of organizations
  ) {
    const totals =
      [...currencies.entries()]
        .sort(([a], [b]) =>
          a.localeCompare(b)
        )
        .map(
          ([currency, values]) => ({
            currency,

            ticketSalesMinor:
              values.ticketSales.toString(),

            donationsMinor:
              values.donations.toString(),

            generatedMinor:
              (
                values.ticketSales +
                values.donations
              ).toString(),
          })
        );

    result.set(
      organizationId,
      totals
    );
  }

  return result;
}

/* ============================================================
   PAGINATION
============================================================ */

function buildPagination(
  page: number,
  pageSize: number,
  total: number
): Pagination {
  const totalPages =
    Math.ceil(
      total / pageSize
    );

  return {
    page,
    pageSize,
    total,
    totalPages,

    hasNextPage:
      page < totalPages,

    hasPreviousPage:
      page > 1 &&
      totalPages > 0,
  };
}

/* ============================================================
   GET /api/admin/organizers
============================================================ */

/**
 * Ã‰tapes :
 *
 * 1. Authentification administrateur.
 * 2. Validation des paramÃ¨tres.
 * 3. Recherche et pagination PostgreSQL.
 * 4. Lecture des organisations.
 * 5. Comptage des publications.
 * 6. AgrÃ©gation des ventes et dons.
 * 7. RÃ©ponse JSON.
 *
 * Les montants BigInt sont convertis
 * en chaÃ®nes avant la rÃ©ponse HTTP.
 *
 * L'interface recevra Ã©galement
 * blueBadgeEnabled pour chaque ligne.
 *
 * L'action Voir utilisera ensuite :
 *
 * GET /api/admin/organizers/[id]
 */

export async function GET(
  request: NextRequest
): Promise<NextResponse> {
  try {
    /* ======================================================
       AUTHENTIFICATION
    ====================================================== */

    const admin =
      await authenticateAdmin(
        request
      );

    if (!admin) {
      return errorResponse(
        "UNAUTHORIZED",
        401
      );
    }

    /* ======================================================
       PARAMÃˆTRES
    ====================================================== */

    const filters =
      parseFilters(request);

    if (!filters) {
      return errorResponse(
        "INVALID_REQUEST",
        400
      );
    }

    const prisma =
      getPlatformPrisma();

    const where =
      buildWhere(filters);

    const skip =
      (
        filters.page - 1
      ) * filters.pageSize;

    /* ======================================================
       LISTE ET TOTAL
    ====================================================== */

    const [
      total,
      organizations,
    ] = await Promise.all([
      prisma.organization.count({
        where,
      }),

      prisma.organization.findMany({
        where,

        orderBy: [
          {
            createdAt: "desc",
          },
          {
            id: "asc",
          },
        ],

        skip,

        take:
          filters.pageSize,

        select: {
          id: true,

          name: true,
          description: true,

          logoStorageKey: true,

          email: true,
          phoneE164: true,

          countryCode: true,
          city: true,

          isActive: true,

          blueBadgeEnabled: true,

          createdAt: true,
          updatedAt: true,

          owner: {
            select: {
              id: true,
              fullName: true,

              email: true,
              phoneE164: true,

              avatarStorageKey: true,

              isActive: true,
              isBlocked: true,
            },
          },

          verification: {
            select: {
              status: true,
            },
          },

          _count: {
            select: {
              events: true,
              campaigns: true,
            },
          },
        },
      }),
    ]);

    /* ======================================================
       IDENTIFIANTS DES ORGANISATEURS
    ====================================================== */

    const organizationIds =
      organizations.map(
        (organization) =>
          organization.id
      );

    /* ======================================================
       STATISTIQUES RÃ‰ELLES
    ====================================================== */

    const [
      publishedCounts,
      ticketSales,
      confirmedDonations,
    ] = await Promise.all([
      getPublishedCounts(
        organizationIds
      ),

      getTicketSales(
        organizationIds
      ),

      getConfirmedDonations(
        organizationIds
      ),
    ]);

    /* ======================================================
       MONTANTS PAR ORGANISATEUR
    ====================================================== */

    const totalsMap =
      buildTotalsByOrganization(
        organizationIds,
        ticketSales,
        confirmedDonations
      );

    /* ======================================================
       CONSTRUCTION DES DONNÃ‰ES
    ====================================================== */

    const items:
      OrganizationListItem[] =
        organizations.map(
          (organization) => {
            const owner =
              organization.owner;

            const statistics:
              OrganizationStatistics = {
                totalEvents:
                  organization._count.events,

                publishedEvents:
                  publishedCounts.events.get(
                    organization.id
                  ) ?? 0,

                totalCampaigns:
                  organization._count.campaigns,

                publishedCampaigns:
                  publishedCounts.campaigns.get(
                    organization.id
                  ) ?? 0,

                amountBasis:
                  "CONFIRMED_GROSS",

                totalsByCurrency:
                  totalsMap.get(
                    organization.id
                  ) ?? [],
              };

            return {
              id:
                organization.id,

              name:
                organization.name,

              description:
                organization.description,

              logoStorageKey:
                organization.logoStorageKey,

              email:
                organization.email ??
                owner.email,

              phoneE164:
                organization.phoneE164 ??
                owner.phoneE164,

              countryCode:
                organization.countryCode,

              city:
                organization.city,

              isActive:
                organization.isActive,

              blueBadgeEnabled:
                organization.blueBadgeEnabled,

              verificationStatus:
                organization.verification?.status ??
                "PENDING",

              owner: {
                id:
                  owner.id,

                fullName:
                  owner.fullName,

                email:
                  owner.email,

                phoneE164:
                  owner.phoneE164,

                avatarStorageKey:
                  owner.avatarStorageKey,

                isActive:
                  owner.isActive,

                isBlocked:
                  owner.isBlocked,
              },

              statistics,

              createdAt:
                organization.createdAt.toISOString(),

              updatedAt:
                organization.updatedAt.toISOString(),
            };
          }
        );

    /* ======================================================
       PAGINATION
    ====================================================== */

    const pagination =
      buildPagination(
        filters.page,
        filters.pageSize,
        total
      );

    /* ======================================================
       RÃ‰PONSE JSON
    ====================================================== */

    return json({
      success: true,

      data: {
        organizers:
          items,

        pagination,

        filters: {
          search:
            filters.search,

          status:
            filters.status,

          badge:
            filters.badge,
        },

        /*
         * Les chiffres financiers correspondent
         * aux ventes brutes confirmÃ©es et dons
         * confirmÃ©s. Ils ne reprÃ©sentent pas
         * le solde net disponible au retrait.
         */

        amountBasis:
          "CONFIRMED_GROSS",

        refreshedAt:
          new Date().toISOString(),
      },
    });
  } catch (error) {
    unstable_rethrow(error);
    /*
     * Ne jamais afficher ou journaliser :
     *
     * - Les tokens de session
     * - Les cookies
     * - Les secrets d'API
     * - Les rÃ©fÃ©rences bancaires
     *
     * On journalise seulement le type
     * d'erreur technique.
     */

    console.error(
      "[TIKEMIA_ADMIN_ORGANIZERS_LIST]",
      error instanceof Error
        ? error.name
        : "UNKNOWN_ERROR"
    );

    return errorResponse(
      "DATABASE_ERROR",
      503
    );
  }
}

/* ============================================================
   MÃ‰THODES NON AUTORISÃ‰ES
============================================================ */

/**
 * La liste est uniquement consultable.
 *
 * L'activation / dÃ©sactivation du badge
 * passe obligatoirement par :
 *
 * PATCH /api/admin/organizers/[id]
 */

function methodNotAllowed():
  NextResponse {
  return new NextResponse(
    null,
    {
      status: 405,

      headers: {
        ...RESPONSE_HEADERS,

        Allow: "GET, HEAD",
      },
    }
  );
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

