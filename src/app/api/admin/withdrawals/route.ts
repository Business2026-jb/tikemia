import { unstable_rethrow } from "next/navigation";
﻿
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
 * TIKEMIA â€” ADMINISTRATION DES RETRAITS
 * ============================================================
 *
 * Fichier :
 * src/app/api/admin/withdrawals/route.ts
 *
 * Endpoint :
 * GET /api/admin/withdrawals
 *
 * RESPONSABILITÃ‰S :
 *
 * 1. VÃ©rifier la session de l'administrateur.
 * 2. VÃ©rifier le rÃ´le ADMIN ou SUPER_ADMIN.
 * 3. Lire les demandes de retrait PostgreSQL.
 * 4. Identifier chaque organisateur.
 * 5. Lire le montant et la devise demandÃ©s.
 * 6. Identifier le moyen de retrait.
 * 7. Afficher le pays et le bÃ©nÃ©ficiaire.
 * 8. Afficher les rÃ©fÃ©rences masquÃ©es.
 * 9. Rechercher des demandes.
 * 10. Filtrer les demandes par statut.
 * 11. Filtrer par pays, devise et moyen.
 * 12. Paginer les rÃ©sultats.
 * 13. Calculer les compteurs par statut.
 * 14. PrÃ©server les informations sensibles.
 *
 * Cette route utilise exclusivement les
 * modÃ¨les Prisma dÃ©jÃ  existants :
 *
 * - Session
 * - User
 * - UserRole
 * - Organization
 * - Payout
 * - PayoutDestination
 * - Event
 * - Campaign
 *
 * AUCUNE modification de schema.prisma.
 *
 * AUCUNE nouvelle table.
 *
 * AUCUN retrait confirmÃ© par cette route.
 *
 * Les coordonnÃ©es complÃ¨tes du bÃ©nÃ©ficiaire
 * seront consultÃ©es uniquement dans :
 *
 * GET /api/admin/withdrawals/[id]
 *
 * La preuve sera gÃ©rÃ©e par :
 *
 * /api/admin/withdrawals/[id]/proof
 *
 * ============================================================
 */


/* ============================================================
   CONSTANTES
============================================================ */

const DEFAULT_PAGE = 1;

const DEFAULT_PAGE_SIZE = 20;

const MAX_PAGE_SIZE = 50;

const MAX_PAGE = 100000;

const MAX_SEARCH_LENGTH = 100;

const MAX_QUERY_LENGTH = 2048;

const SESSION_COOKIE_NAME =
  "tikemia_admin_session";

const PAYOUT_STATUSES = [
  "REQUESTED",
  "UNDER_REVIEW",
  "APPROVED",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "REJECTED",
  "CANCELLED",
] as const;

const PAYOUT_PURPOSES = [
  "EVENT_REVENUE",
  "CAMPAIGN_FUNDS",
] as const;

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

type PayoutStatus =
  (typeof PAYOUT_STATUSES)[number];

type PayoutPurpose =
  (typeof PAYOUT_PURPOSES)[number];

type StatusFilter =
  | "ALL"
  | PayoutStatus;

type PurposeFilter =
  | "ALL"
  | PayoutPurpose;

type WithdrawalFilters = {
  page: number;
  pageSize: number;

  search: string;

  status: StatusFilter;

  purpose: PurposeFilter;

  country: string | null;

  currency: string | null;

  method: string | null;
};

type ApiErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_REQUEST"
  | "DATABASE_ERROR";

type WithdrawalListItem = {
  id: string;

  reference: string;

  purpose: PayoutPurpose;

  status: PayoutStatus;

  amountMinor: string;

  currency: string;

  requestedAt: string;

  completedAt: string | null;

  updatedAt: string;

  organizer: {
    id: string;

    name: string;

    email: string | null;

    phoneE164: string | null;

    countryCode: string | null;

    city: string | null;

    owner: {
      id: string;

      fullName: string;

      email: string;

      phoneE164: string | null;
    };
  };

  destination: {
    id: string;

    type: string;

    provider: string;

    accountName: string;

    maskedAccountRef: string | null;

    bankName: string | null;

    countryCode: string;

    currency: string;

    label: string | null;

    assetCode: string | null;

    networkCode: string | null;

    isVerified: boolean;

    isActive: boolean;
  };

  source: {
    type: "EVENT" | "CAMPAIGN" | "UNSPECIFIED";

    id: string | null;

    title: string | null;
  };
};

type WithdrawalCounts = {
  total: number;

  requested: number;

  underReview: number;

  approved: number;

  processing: number;

  completed: number;

  failed: number;

  rejected: number;

  cancelled: number;

  pendingAction: number;
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
   RÃ‰PONSES HTTP
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
   VALIDATION DES PARAMÃˆTRES
============================================================ */

function parseInteger(
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

  const number = Number(value);

  if (
    !Number.isSafeInteger(number) ||
    number < 1 ||
    number > maximum
  ) {
    return null;
  }

  return number;
}

function isPayoutStatus(
  value: string
): value is PayoutStatus {
  return PAYOUT_STATUSES.some(
    (status) => status === value
  );
}

function isPayoutPurpose(
  value: string
): value is PayoutPurpose {
  return PAYOUT_PURPOSES.some(
    (purpose) => purpose === value
  );
}

/**
 * ParamÃ¨tres autorisÃ©s :
 *
 * page
 * pageSize
 * search
 * status
 * purpose
 * country
 * currency
 * method
 *
 * Exemple :
 *
 * ?page=1&pageSize=20&status=REQUESTED
 *
 * Les paramÃ¨tres inconnus ou rÃ©pÃ©tÃ©s
 * sont refusÃ©s.
 */

function parseFilters(
  request: NextRequest
): WithdrawalFilters | null {
  const url = request.nextUrl;

  if (
    url.search.length >
    MAX_QUERY_LENGTH
  ) {
    return null;
  }

  const params =
    url.searchParams;

  const allowed = new Set([
    "page",
    "pageSize",
    "search",
    "status",
    "purpose",
    "country",
    "currency",
    "method",
  ]);

  for (const key of params.keys()) {
    if (!allowed.has(key)) {
      return null;
    }

    if (params.getAll(key).length !== 1) {
      return null;
    }
  }

  const page = parseInteger(
    params.get("page"),
    DEFAULT_PAGE,
    MAX_PAGE
  );

  const pageSize = parseInteger(
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
    params.get("search") ?? ""
  ).trim();

  if (
    search.length >
      MAX_SEARCH_LENGTH ||
    /[\x00-\x1F\x7F]/.test(search)
  ) {
    return null;
  }

  const rawStatus = (
    params.get("status") ?? "ALL"
  ).toUpperCase();

  if (
    rawStatus !== "ALL" &&
    !isPayoutStatus(rawStatus)
  ) {
    return null;
  }

  const status =
    rawStatus as StatusFilter;

  const rawPurpose = (
    params.get("purpose") ?? "ALL"
  ).toUpperCase();

  if (
    rawPurpose !== "ALL" &&
    !isPayoutPurpose(rawPurpose)
  ) {
    return null;
  }

  const purpose =
    rawPurpose as PurposeFilter;

  const rawCountry = (
    params.get("country") ?? ""
  )
    .trim()
    .toUpperCase();

  if (
    rawCountry &&
    !/^[A-Z]{2}$/.test(rawCountry)
  ) {
    return null;
  }

  const rawCurrency = (
    params.get("currency") ?? ""
  )
    .trim()
    .toUpperCase();

  if (
    rawCurrency &&
    !/^[A-Z]{3}$/.test(rawCurrency)
  ) {
    return null;
  }

  const rawMethod = (
    params.get("method") ?? ""
  )
    .trim()
    .toUpperCase();

  if (
    rawMethod &&
    !/^[A-Z][A-Z0-9_]{0,49}$/.test(
      rawMethod
    )
  ) {
    return null;
  }

  return {
    page,
    pageSize,

    search,

    status,

    purpose,

    country:
      rawCountry || null,

    currency:
      rawCurrency || null,

    method:
      rawMethod || null,
  };
}

/* ============================================================
   AUTHENTIFICATION ADMINISTRATEUR
============================================================ */

/**
 * La mÃªme logique que celle utilisÃ©e dans :
 *
 * src/app/api/admin/organizers/route.ts
 *
 * Le cookie de session doit correspondre
 * au mÃ©canisme rÃ©el de connexion TIKEMIA.
 *
 * Le code suppose :
 *
 * Session.tokenHash =
 * SHA-256(jeton brut du cookie)
 *
 * IMPORTANT :
 *
 * Si ton authentification actuelle utilise
 * un autre nom de cookie ou un autre
 * algorithme de hachage, cette fonction
 * devra utiliser le mÃ©canisme existant.
 *
 * Aucun accÃ¨s anonyme n'est autorisÃ©.
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

  const tokenHash = createHash("sha256")
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

  const isSuperAdmin =
    user.roles.some(
      (item) =>
        item.role === "SUPER_ADMIN"
    );

  if (isSuperAdmin) {
    return {
      id: user.id,
      role: "SUPER_ADMIN",
    };
  }

  const isAdmin =
    user.roles.some(
      (item) =>
        item.role === "ADMIN"
    );

  if (!isAdmin) {
    return null;
  }

  return {
    id: user.id,
    role: "ADMIN",
  };
}

/* ============================================================
   CONSTRUCTION DES FILTRES POSTGRESQL
============================================================ */

/**
 * Prisma gÃ©nÃ¨re les requÃªtes paramÃ©trÃ©es.
 *
 * Recherche :
 *
 * - RÃ©fÃ©rence du retrait
 * - Nom de l'organisation
 * - Email de l'organisation
 * - TÃ©lÃ©phone de l'organisation
 * - Nom complet du responsable
 * - Email du responsable
 * - Nom du bÃ©nÃ©ficiaire
 *
 * Les rÃ©fÃ©rences bancaires complÃ¨tes
 * ne sont jamais utilisÃ©es dans la recherche.
 */

function buildWhere(
  filters: WithdrawalFilters
) {
  const search =
    filters.search;

  return {
    ...(filters.status !== "ALL"
      ? {
          status: filters.status,
        }
      : {}),

    ...(filters.purpose !== "ALL"
      ? {
          purpose: filters.purpose,
        }
      : {}),

    ...(filters.currency
      ? {
          currency:
            filters.currency,
        }
      : {}),

    ...(filters.country ||
    filters.method
      ? {
          destination: {
            is: {
              ...(filters.country
                ? {
                    countryCode:
                      filters.country,
                  }
                : {}),

              ...(filters.method
                ? {
                    type: filters.method,
                  }
                : {}),
            },
          },
        }
      : {}),

    ...(search
      ? {
          OR: [
            {
              reference: {
                contains: search,
                mode:
                  "insensitive" as const,
              },
            },

            {
              organization: {
                is: {
                  name: {
                    contains: search,
                    mode:
                      "insensitive" as const,
                  },
                },
              },
            },

            {
              organization: {
                is: {
                  email: {
                    contains: search,
                    mode:
                      "insensitive" as const,
                  },
                },
              },
            },

            {
              organization: {
                is: {
                  phoneE164: {
                    contains: search,
                  },
                },
              },
            },

            {
              organization: {
                is: {
                  owner: {
                    is: {
                      fullName: {
                        contains:
                          search,
                        mode:
                          "insensitive" as const,
                      },
                    },
                  },
                },
              },
            },

            {
              organization: {
                is: {
                  owner: {
                    is: {
                      email: {
                        contains:
                          search,
                        mode:
                          "insensitive" as const,
                      },
                    },
                  },
                },
              },
            },

            {
              destination: {
                is: {
                  accountName: {
                    contains: search,
                    mode:
                      "insensitive" as const,
                  },
                },
              },
            },
          ],
        }
      : {}),
  };
}

/* ============================================================
   COMPTEURS PAR STATUT
============================================================ */

/**
 * Ces compteurs sont calculÃ©s depuis
 * toutes les demandes de retrait.
 *
 * Ils ne dÃ©pendent pas de la pagination.
 *
 * REQUESTED :
 * Nouvelle demande.
 *
 * UNDER_REVIEW :
 * En vÃ©rification administrative.
 *
 * APPROVED :
 * Demande approuvÃ©e.
 *
 * PROCESSING :
 * Transfert en traitement.
 *
 * COMPLETED :
 * Retrait effectivement rÃ©alisÃ©.
 */

async function getWithdrawalCounts():
  Promise<WithdrawalCounts> {
  const prisma =
    getPlatformPrisma();

  const groups =
    await prisma.payout.groupBy({
      by: ["status"],

      _count: {
        _all: true,
      },
    });

  const values: WithdrawalCounts = {
    total: 0,

    requested: 0,

    underReview: 0,

    approved: 0,

    processing: 0,

    completed: 0,

    failed: 0,

    rejected: 0,

    cancelled: 0,

    pendingAction: 0,
  };

  for (const group of groups) {
    const count =
      group._count._all;

    values.total += count;

    switch (group.status) {
      case "REQUESTED":
        values.requested += count;
        break;

      case "UNDER_REVIEW":
        values.underReview += count;
        break;

      case "APPROVED":
        values.approved += count;
        break;

      case "PROCESSING":
        values.processing += count;
        break;

      case "COMPLETED":
        values.completed += count;
        break;

      case "FAILED":
        values.failed += count;
        break;

      case "REJECTED":
        values.rejected += count;
        break;

      case "CANCELLED":
        values.cancelled += count;
        break;
    }
  }

  values.pendingAction =
    values.requested +
    values.underReview +
    values.approved +
    values.processing;

  return values;
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
   FORMATAGE D'UNE DEMANDE
============================================================ */

/**
 * La liste ne contient pas :
 *
 * - accountRefEncrypted
 * - IBAN complet
 * - NumÃ©ro de compte complet
 * - Informations bancaires secrÃ¨tes
 * - ClÃ©s de chiffrement
 * - Documents sensibles
 *
 * Ces informations seront accessibles
 * uniquement Ã  l'administrateur autorisÃ©
 * dans l'API de dÃ©tails.
 *
 * Les montants BigInt sont convertis
 * en chaÃ®nes pour Ãªtre compatibles JSON.
 */

function formatWithdrawal(
  payout: {
    id: string;

    reference: string;

    purpose: PayoutPurpose;

    amount: bigint;

    currency: string;

    status: PayoutStatus;

    requestedAt: Date;

    completedAt: Date | null;

    updatedAt: Date;

    organization: {
      id: string;

      name: string;

      email: string | null;

      phoneE164: string | null;

      countryCode: string | null;

      city: string | null;

      owner: {
        id: string;

        fullName: string;

        email: string;

        phoneE164: string | null;
      };
    };

    destination: {
      id: string;

      type: string;

      provider: string;

      accountName: string;

      maskedAccountRef:
        string | null;

      bankName: string | null;

      countryCode: string;

      currency: string;

      label: string | null;

      assetCode: string | null;

      networkCode: string | null;

      isVerified: boolean;

      isActive: boolean;
    };

    event: {
      id: string;
      title: string;
    } | null;

    campaign: {
      id: string;
      title: string;
    } | null;
  }
): WithdrawalListItem {
  const organization =
    payout.organization;

  const destination =
    payout.destination;

  let source:
    WithdrawalListItem["source"];

  if (payout.event) {
    source = {
      type: "EVENT",

      id: payout.event.id,

      title: payout.event.title,
    };
  } else if (payout.campaign) {
    source = {
      type: "CAMPAIGN",

      id: payout.campaign.id,

      title: payout.campaign.title,
    };
  } else {
    source = {
      type: "UNSPECIFIED",

      id: null,

      title: null,
    };
  }

  return {
    id: payout.id,

    reference:
      payout.reference,

    purpose:
      payout.purpose,

    status:
      payout.status,

    amountMinor:
      payout.amount.toString(),

    currency:
      payout.currency,

    requestedAt:
      payout.requestedAt.toISOString(),

    completedAt:
      payout.completedAt?.toISOString() ??
      null,

    updatedAt:
      payout.updatedAt.toISOString(),

    organizer: {
      id:
        organization.id,

      name:
        organization.name,

      email:
        organization.email ??
        organization.owner.email,

      phoneE164:
        organization.phoneE164 ??
        organization.owner.phoneE164,

      countryCode:
        organization.countryCode,

      city:
        organization.city,

      owner: {
        id:
          organization.owner.id,

        fullName:
          organization.owner.fullName,

        email:
          organization.owner.email,

        phoneE164:
          organization.owner.phoneE164,
      },
    },

    destination: {
      id:
        destination.id,

      type:
        destination.type,

      provider:
        destination.provider,

      accountName:
        destination.accountName,

      maskedAccountRef:
        destination.maskedAccountRef,

      bankName:
        destination.bankName,

      countryCode:
        destination.countryCode,

      currency:
        destination.currency,

      label:
        destination.label,

      assetCode:
        destination.assetCode,

      networkCode:
        destination.networkCode,

      isVerified:
        destination.isVerified,

      isActive:
        destination.isActive,
    },

    source,
  };
}

/* ============================================================
   GET /api/admin/withdrawals
============================================================ */

/**
 * RÃ©cupÃ¨re la liste des retraits
 * depuis la base PostgreSQL.
 *
 * Toutes les demandes sont incluses :
 *
 * REQUESTED
 * UNDER_REVIEW
 * APPROVED
 * PROCESSING
 * COMPLETED
 * FAILED
 * REJECTED
 * CANCELLED
 *
 * Les demandes sont triÃ©es par date,
 * de la plus rÃ©cente Ã  la plus ancienne.
 *
 * Les donnÃ©es ne sont pas mises en cache.
 */

export async function GET(
  request: NextRequest
): Promise<NextResponse> {
  try {
    /* ======================================================
       1. AUTHENTIFICATION
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
       2. VALIDATION DES FILTRES
    ====================================================== */

    const filters =
      parseFilters(request);

    if (!filters) {
      return errorResponse(
        "INVALID_REQUEST",
        400
      );
    }

    /* ======================================================
       3. CLIENT POSTGRESQL
    ====================================================== */

    const prisma =
      getPlatformPrisma();

    const where =
      buildWhere(filters);

    const skip =
      (
        filters.page - 1
      ) * filters.pageSize;

    /* ======================================================
       4. LECTURE DES DONNÃ‰ES
    ====================================================== */

    const [
      totalFiltered,
      payouts,
      counts,
    ] = await Promise.all([
      /*
       * Nombre total de retraits
       * correspondant aux filtres.
       */

      prisma.payout.count({
        where,
      }),

      /*
       * Retraits de la page demandÃ©e.
       *
       * Nous chargeons uniquement
       * les champs nÃ©cessaires.
       *
       * Aucun compte bancaire complet
       * n'est envoyÃ© dans cette liste.
       */

      prisma.payout.findMany({
        where,

        orderBy: [
          {
            requestedAt: "desc",
          },

          {
            id: "desc",
          },
        ],

        skip,

        take:
          filters.pageSize,

        select: {
          id: true,

          reference: true,

          purpose: true,

          amount: true,

          currency: true,

          status: true,

          requestedAt: true,

          completedAt: true,

          updatedAt: true,

          organization: {
            select: {
              id: true,

              name: true,

              email: true,

              phoneE164: true,

              countryCode: true,

              city: true,

              owner: {
                select: {
                  id: true,

                  fullName: true,

                  email: true,

                  phoneE164: true,
                },
              },
            },
          },

          destination: {
            select: {
              id: true,

              type: true,

              provider: true,

              accountName: true,

              maskedAccountRef: true,

              bankName: true,

              countryCode: true,

              currency: true,

              label: true,

              assetCode: true,

              networkCode: true,

              isVerified: true,

              isActive: true,
            },
          },

          event: {
            select: {
              id: true,

              title: true,
            },
          },

          campaign: {
            select: {
              id: true,

              title: true,
            },
          },
        },
      }),

      /*
       * Compteurs gÃ©nÃ©raux
       * de la page administrateur.
       */

      getWithdrawalCounts(),
    ]);

    /* ======================================================
       5. PAGINATION
    ====================================================== */

    const pagination =
      buildPagination(
        filters.page,
        filters.pageSize,
        totalFiltered
      );

    /* ======================================================
       6. NORMALISATION JSON
    ====================================================== */

    const withdrawals:
      WithdrawalListItem[] =
        payouts.map(
          formatWithdrawal
        );

    /* ======================================================
       7. RÃ‰PONSE
    ====================================================== */

    return json({
      success: true,

      data: {
        withdrawals,

        pagination,

        summary: counts,

        filters: {
          search:
            filters.search,

          status:
            filters.status,

          purpose:
            filters.purpose,

          country:
            filters.country,

          currency:
            filters.currency,

          method:
            filters.method,
        },

        refreshedAt:
          new Date().toISOString(),
      },
    });
  } catch (error) {
    unstable_rethrow(error);
    /*
     * Ne jamais journaliser :
     *
     * - Les cookies
     * - Les tokens
     * - Les IBAN
     * - Les comptes bancaires
     * - Les clÃ©s de chiffrement
     * - Les contenus des preuves
     */

    console.error(
      "[TIKEMIA_ADMIN_WITHDRAWALS_LIST]",
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
 * Cette route est exclusivement
 * destinÃ©e Ã  la consultation.
 *
 * Les actions sur une demande
 * sont effectuÃ©es dans :
 *
 * /api/admin/withdrawals/[id]
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

