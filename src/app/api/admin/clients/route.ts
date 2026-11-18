import { unstable_rethrow } from "next/navigation";

import "server-only";

import {
  createHash,
} from "node:crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getPlatformPrisma,
} from "@/lib/payments/fulfillment";

/**
 * ============================================================
 * TIKEMIA — ADMINISTRATION / CLIENTS
 * ============================================================
 *
 * FICHIER :
 * src/app/api/admin/clients/route.ts
 *
 * ENDPOINT :
 * GET /api/admin/clients
 *
 * PARAMÈTRES :
 *
 * page     : numéro de la page
 * pageSize : nombre de clients par page
 * search   : recherche facultative
 *
 * EXEMPLES :
 *
 * GET /api/admin/clients
 *
 * GET /api/admin/clients?page=1&pageSize=20
 *
 * GET /api/admin/clients?page=1&pageSize=20&search=jean
 *
 * FONCTIONNALITÉS :
 *
 * - Authentification ADMIN / SUPER_ADMIN
 * - Lecture PostgreSQL
 * - Clients inscrits
 * - Clients ayant acheté des billets
 * - Clients ayant effectué des dons
 * - Acheteurs invités
 * - Déduplication par email
 * - Nom du client
 * - Email
 * - Téléphone
 * - Statistiques globales
 * - Recherche
 * - Pagination
 * - Actualisation à chaque requête
 *
 * CONTRAT AVEC :
 *
 * src/app/admin/clients/page.tsx
 *
 * src/app/api/admin/clients/export/route.ts
 *
 * AUCUNE donnée fictive.
 * AUCUNE modification PostgreSQL.
 * AUCUNE modification du schéma Prisma.
 * AUCUNE dépendance supplémentaire.
 *
 * Le frontend se charge de l'affichage
 * responsive sur mobile et PC.
 *
 * ============================================================
 */


/* ============================================================
   CONSTANTES
============================================================ */

const SESSION_COOKIE_NAME =
  "tikemia_admin_session";

const DEFAULT_PAGE = 1;

const DEFAULT_PAGE_SIZE = 20;

const MAX_PAGE_SIZE = 50;

const MAX_PAGE = 1_000_000;

const MAX_SEARCH_LENGTH = 100;

const DATABASE_BATCH_SIZE = 500;

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

type ClientSource =
  | "REGISTERED"
  | "GUEST";

type ClientRecord = {
  id: string;

  name: string;

  email: string;

  phoneE164: string | null;

  source: ClientSource;

  registeredAt: Date | null;
};

type ClientResponse = {
  id: string;

  name: string;

  email: string;

  phoneE164: string | null;

  source: ClientSource;

  registeredAt: string | null;
};

type QueryFilters = {
  page: number;

  pageSize: number;

  search: string;
};

type ClientsSummary = {
  totalClients: number;

  withPhone: number;
};

type Pagination = {
  page: number;

  pageSize: number;

  total: number;

  totalPages: number;

  hasNextPage: boolean;

  hasPreviousPage: boolean;
};

/* ============================================================
   ERREURS MÉTIER
============================================================ */

class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    public readonly statusCode: number
  ) {
    super(code);

    this.name = "ApiError";
  }
}

/* ============================================================
   RÉPONSES HTTP
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

function handleError(
  error: unknown
): NextResponse {
  if (error instanceof ApiError) {
    return fail(
      error.code,
      error.statusCode
    );
  }

  console.error(
    "[TIKEMIA_ADMIN_CLIENTS_GET]",
    error instanceof Error
      ? error.name
      : "UNKNOWN_ERROR"
  );

  return fail(
    "DATABASE_ERROR",
    503
  );
}

/* ============================================================
   AUTHENTIFICATION ADMINISTRATEUR
============================================================ */

/**
 * Même contrat de session utilisé
 * dans les autres routes administrateur.
 *
 * Cookie :
 * tikemia_session
 *
 * Session.tokenHash :
 * SHA-256 du jeton brut.
 *
 * Conditions :
 *
 * - Session existante
 * - Session non révoquée
 * - Session non expirée
 * - Utilisateur actif
 * - Utilisateur non bloqué
 * - Rôle ADMIN ou SUPER_ADMIN
 */

async function authenticateAdmin(
  request: NextRequest
): Promise<AdminIdentity | null> {
  const token =
    request.cookies.get(
      SESSION_COOKIE_NAME
    )?.value;

  if (
    !token ||
    !/^[a-f0-9]{64}$/.test(token)
  ) {
    return null;
  }

  const tokenHash =
    createHash("sha256")
      .update(Buffer.from(token, "hex"))
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
  defaultValue: number,
  maximum: number
): number | null {
  if (value === null) {
    return defaultValue;
  }

  if (
    !/^[1-9][0-9]*$/.test(value)
  ) {
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

function parseQuery(
  request: NextRequest
): QueryFilters {
  const params =
    request.nextUrl.searchParams;

  const allowedParams =
    new Set([
      "page",
      "pageSize",
      "search",
    ]);

  /* --------------------------------------------------------
     REFUSER LES PARAMÈTRES INATTENDUS
  -------------------------------------------------------- */

  for (const key of params.keys()) {
    if (
      !allowedParams.has(key) ||
      params.getAll(key).length !== 1
    ) {
      throw new ApiError(
        "INVALID_REQUEST",
        400
      );
    }
  }

  /* --------------------------------------------------------
     PAGE
  -------------------------------------------------------- */

  const page =
    parsePositiveInteger(
      params.get("page"),
      DEFAULT_PAGE,
      MAX_PAGE
    );

  /* --------------------------------------------------------
     TAILLE DE PAGE
  -------------------------------------------------------- */

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
    throw new ApiError(
      "INVALID_REQUEST",
      400
    );
  }

  /* --------------------------------------------------------
     RECHERCHE
  -------------------------------------------------------- */

  const search =
    (
      params.get("search") ??
      ""
    ).trim();

  if (
    search.length > MAX_SEARCH_LENGTH ||
    /[\u0000-\u001F\u007F]/.test(search)
  ) {
    throw new ApiError(
      "INVALID_REQUEST",
      400
    );
  }

  return {
    page,

    pageSize,

    search,
  };
}

/* ============================================================
   NORMALISATION DES DONNÉES
============================================================ */

/**
 * Ces fonctions reprennent la logique
 * utilisée dans la route d'export PDF.
 *
 * Ainsi :
 *
 * - Même normalisation d'email
 * - Même traitement du téléphone
 * - Même priorité aux comptes inscrits
 * - Même règle de déduplication
 */

function normalizeEmail(
  value: string
): string {
  return value
    .trim()
    .toLowerCase();
}

function normalizePhone(
  value: string | null | undefined
): string | null {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const phone =
    value.trim();

  return phone || null;
}

function cleanName(
  value: string | null | undefined
): string {
  const name =
    typeof value === "string"
      ? value.trim()
      : "";

  return name ||
    "Non renseigné";
}

/* ============================================================
   CHARGEMENT DES CLIENTS INSCRITS
============================================================ */

/**
 * Pour TIKEMIA, les clients incluent :
 *
 * 1. Les utilisateurs avec rôle CLIENT.
 *
 * 2. Les utilisateurs ayant réalisé
 *    au moins une commande.
 *
 * 3. Les utilisateurs ayant effectué
 *    au moins un don.
 *
 * Un organisateur ou administrateur
 * ayant personnellement effectué
 * une commande ou un don peut donc
 * figurer dans la liste des clients.
 *
 * En revanche, un compte seulement
 * administrateur ou organisateur,
 * sans activité client ni rôle CLIENT,
 * n'est pas ajouté.
 */

async function loadRegisteredClients(
  clientsByEmail: Map<
    string,
    ClientRecord
  >
): Promise<void> {
  const prisma =
    getPlatformPrisma();

  let cursor:
    string | undefined;

  while (true) {
    const users =
      await prisma.user.findMany({
        where: {
          OR: [
            {
              roles: {
                some: {
                  role: "CLIENT",
                },
              },
            },

            {
              orders: {
                some: {},
              },
            },

            {
              donations: {
                some: {},
              },
            },
          ],
        },

        take:
          DATABASE_BATCH_SIZE,

        ...(cursor
          ? {
              skip: 1,

              cursor: {
                id: cursor,
              },
            }
          : {}),

        orderBy: {
          id: "asc",
        },

        select: {
          id: true,

          fullName: true,

          email: true,

          phoneE164: true,

          createdAt: true,
        },
      });

    if (
      users.length === 0
    ) {
      break;
    }

    for (const user of users) {
      const email =
        normalizeEmail(
          user.email
        );

      if (!email) {
        continue;
      }

      clientsByEmail.set(
        email,
        {
          id: user.id,

          name: cleanName(
            user.fullName
          ),

          email:
            user.email.trim(),

          phoneE164:
            normalizePhone(
              user.phoneE164
            ),

          source:
            "REGISTERED",

          registeredAt:
            user.createdAt,
        }
      );
    }

    cursor =
      users[
        users.length - 1
      ].id;

    if (
      users.length <
      DATABASE_BATCH_SIZE
    ) {
      break;
    }
  }
}

/* ============================================================
   CHARGEMENT DES ACHETEURS INVITÉS
============================================================ */

/**
 * TIKEMIA permet les achats sans compte.
 *
 * Ces clients existent dans Order :
 *
 * - buyerId = null
 * - guestEmail
 * - guestPhoneE164
 *
 * Ils sont inclus même si le numéro
 * de téléphone n'est pas renseigné.
 *
 * Les emails sont dédupliqués.
 *
 * Si une adresse correspond à un
 * client déjà inscrit :
 *
 * - On conserve le compte inscrit.
 * - On conserve son vrai nom.
 * - On complète le téléphone seulement
 *   si son compte n'en possède pas.
 *
 * Aucun invité n'est compté deux fois
 * avec la même adresse email.
 */

async function loadGuestClients(
  clientsByEmail: Map<
    string,
    ClientRecord
  >
): Promise<void> {
  const prisma =
    getPlatformPrisma();

  let cursor:
    string | undefined;

  while (true) {
    const orders =
      await prisma.order.findMany({
        where: {
          buyerId: null,
        },

        take:
          DATABASE_BATCH_SIZE,

        ...(cursor
          ? {
              skip: 1,

              cursor: {
                id: cursor,
              },
            }
          : {}),

        orderBy: {
          id: "asc",
        },

        select: {
          id: true,

          guestEmail: true,

          guestPhoneE164: true,

          createdAt: true,
        },
      });

    if (
      orders.length === 0
    ) {
      break;
    }

    for (const order of orders) {
      const email =
        normalizeEmail(
          order.guestEmail
        );

      if (!email) {
        continue;
      }

      const phone =
        normalizePhone(
          order.guestPhoneE164
        );

      const existing =
        clientsByEmail.get(
          email
        );

      /* ------------------------------------------------------
         EMAIL DÉJÀ PRÉSENT
      ------------------------------------------------------ */

      if (existing) {
        if (
          !existing.phoneE164 &&
          phone
        ) {
          existing.phoneE164 =
            phone;
        }

        continue;
      }

      /* ------------------------------------------------------
         NOUVEL ACHETEUR INVITÉ
      ------------------------------------------------------ */

      clientsByEmail.set(
        email,
        {
          id:
            order.id,

          name:
            "Client invité",

          email:
            order.guestEmail.trim(),

          phoneE164:
            phone,

          source:
            "GUEST",

          registeredAt:
            order.createdAt,
        }
      );
    }

    cursor =
      orders[
        orders.length - 1
      ].id;

    if (
      orders.length <
      DATABASE_BATCH_SIZE
    ) {
      break;
    }
  }
}

/* ============================================================
   CENTRALISATION DES CLIENTS
============================================================ */

/**
 * Cette fonction rassemble les clients
 * à partir des tables existantes.
 *
 * Elle suit la même logique que :
 *
 * /api/admin/clients/export
 *
 * Aucun résultat artificiel.
 *
 * Aucune limite globale de 20 clients :
 * tous les enregistrements concernés
 * sont parcourus par lots.
 */

async function loadAllClients():
  Promise<ClientRecord[]> {
  const clientsByEmail =
    new Map<
      string,
      ClientRecord
    >();

  await loadRegisteredClients(
    clientsByEmail
  );

  await loadGuestClients(
    clientsByEmail
  );

  return Array.from(
    clientsByEmail.values()
  );
}

/* ============================================================
   RECHERCHE
============================================================ */

/**
 * La recherche s'applique à :
 *
 * - Nom
 * - Adresse email
 * - Numéro de téléphone
 *
 * Elle s'effectue AVANT la pagination.
 *
 * Un client de la page 50 peut donc
 * être retrouvé depuis la page 1
 * en lançant une recherche.
 */

function filterClients(
  clients: ClientRecord[],
  search: string
): ClientRecord[] {
  const query =
    search
      .trim()
      .toLocaleLowerCase(
        "fr"
      );

  if (!query) {
    return clients;
  }

  return clients.filter(
    (client) => {
      const fields = [
        client.name,

        client.email,

        client.phoneE164 ??
          "",
      ];

      return fields.some(
        (field) =>
          field
            .toLocaleLowerCase(
              "fr"
            )
            .includes(query)
      );
    }
  );
}

/* ============================================================
   TRI DES CLIENTS
============================================================ */

/**
 * Même ordre que l'export PDF :
 *
 * 1. Nom
 * 2. Adresse email
 *
 * Cela garantit un affichage stable
 * et une pagination prévisible.
 */

function sortClients(
  clients: ClientRecord[]
): ClientRecord[] {
  return clients.sort(
    (a, b) => {
      const nameComparison =
        a.name.localeCompare(
          b.name,
          "fr",
          {
            sensitivity:
              "base",
          }
        );

      if (
        nameComparison !== 0
      ) {
        return nameComparison;
      }

      return a.email.localeCompare(
        b.email,
        "fr",
        {
          sensitivity:
            "base",
        }
      );
    }
  );
}

/* ============================================================
   STATISTIQUES GLOBALES
============================================================ */

/**
 * Les deux indicateurs affichés
 * en haut de la page sont globaux.
 *
 * Ils ne changent pas lorsqu'un
 * administrateur effectue une recherche.
 *
 * totalClients :
 * nombre de clients distincts par email.
 *
 * withPhone :
 * nombre de clients ayant un téléphone.
 */

function buildSummary(
  clients: ClientRecord[]
): ClientsSummary {
  let withPhone = 0;

  for (const client of clients) {
    if (
      client.phoneE164 &&
      client.phoneE164.trim()
    ) {
      withPhone += 1;
    }
  }

  return {
    totalClients:
      clients.length,

    withPhone,
  };
}

/* ============================================================
   PAGINATION
============================================================ */

function paginateClients(
  clients: ClientRecord[],
  page: number,
  pageSize: number
): {
  rows: ClientRecord[];

  pagination: Pagination;
} {
  const total =
    clients.length;

  const totalPages =
    Math.ceil(
      total /
      pageSize
    );

  const start =
    (page - 1) *
    pageSize;

  const end =
    start +
    pageSize;

  const rows =
    clients.slice(
      start,
      end
    );

  return {
    rows,

    pagination: {
      page,

      pageSize,

      total,

      totalPages,

      hasNextPage:
        page < totalPages,

      hasPreviousPage:
        page > 1 &&
        totalPages > 0,
    },
  };
}

/* ============================================================
   FORMAT DE RÉPONSE CLIENT
============================================================ */

function serializeClient(
  client: ClientRecord
): ClientResponse {
  return {
    id:
      client.id,

    name:
      client.name,

    email:
      client.email,

    phoneE164:
      client.phoneE164,

    source:
      client.source,

    registeredAt:
      client.registeredAt
        ?.toISOString() ??
      null,
  };
}

/* ============================================================
   GET — LISTE DES CLIENTS
============================================================ */

export async function GET(
  request: NextRequest
): Promise<NextResponse> {
  try {
    /* --------------------------------------------------------
       1. AUTHENTIFICATION
    -------------------------------------------------------- */

    const admin =
      await authenticateAdmin(
        request
      );

    if (!admin) {
      return fail(
        "UNAUTHORIZED",
        401
      );
    }

    /* --------------------------------------------------------
       2. PARAMÈTRES DE LA REQUÊTE
    -------------------------------------------------------- */

    const filters =
      parseQuery(
        request
      );

    /* --------------------------------------------------------
       3. RÉCUPÉRER TOUS LES CLIENTS
    -------------------------------------------------------- */

    const allClients =
      await loadAllClients();

    /* --------------------------------------------------------
       4. STATISTIQUES GLOBALES
    -------------------------------------------------------- */

    const summary =
      buildSummary(
        allClients
      );

    /* --------------------------------------------------------
       5. RECHERCHE
    -------------------------------------------------------- */

    const filteredClients =
      filterClients(
        allClients,
        filters.search
      );

    /* --------------------------------------------------------
       6. TRI
    -------------------------------------------------------- */

    const sortedClients =
      sortClients(
        filteredClients
      );

    /* --------------------------------------------------------
       7. PAGINATION
    -------------------------------------------------------- */

    const {
      rows,
      pagination,
    } =
      paginateClients(
        sortedClients,
        filters.page,
        filters.pageSize
      );

    /* --------------------------------------------------------
       8. FORMAT JSON
    -------------------------------------------------------- */

    const clients =
      rows.map(
        serializeClient
      );

    /* --------------------------------------------------------
       9. RÉPONSE À LA PAGE ADMIN
    -------------------------------------------------------- */

    return json({
      success: true,

      data: {
        clients,

        summary: {
          totalClients:
            summary.totalClients,

          withPhone:
            summary.withPhone,
        },

        pagination: {
          page:
            pagination.page,

          pageSize:
            pagination.pageSize,

          total:
            pagination.total,

          totalPages:
            pagination.totalPages,

          hasNextPage:
            pagination.hasNextPage,

          hasPreviousPage:
            pagination.hasPreviousPage,
        },

        filters: {
          search:
            filters.search,

          page:
            filters.page,

          pageSize:
            filters.pageSize,
        },

        refreshedAt:
          new Date()
            .toISOString(),
      },
    });
  } catch (error) {
    unstable_rethrow(error);
    return handleError(
      error
    );
  }
}

/* ============================================================
   MÉTHODES NON AUTORISÉES
============================================================ */

/**
 * Cette API est strictement réservée
 * à la lecture des clients.
 *
 * Elle ne doit jamais :
 *
 * - Créer un compte
 * - Modifier un compte
 * - Supprimer un client
 * - Modifier les coordonnées
 * - Modifier les rôles
 */

function methodNotAllowed():
  NextResponse {
  return new NextResponse(
    null,
    {
      status: 405,

      headers: {
        ...RESPONSE_HEADERS,

        Allow:
          "GET, HEAD",
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
