import { decryptWithdrawalDetails } from "@/lib/withdrawals/email";
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
 * TIKEMIA â€” ADMINISTRATION DES ORGANISATEURS
 * ============================================================
 *
 * Fichier :
 * src/app/api/admin/organizers/[id]/route.ts
 *
 * GET :
 * /api/admin/organizers/:id
 *
 * PATCH :
 * /api/admin/organizers/:id
 *
 * FonctionnalitÃ©s :
 *
 * 1. Authentifier l'administrateur.
 * 2. VÃ©rifier son rÃ´le PostgreSQL.
 * 3. Charger les informations de l'organisation.
 * 4. Compter ses Ã©vÃ©nements publiÃ©s.
 * 5. Compter ses cagnottes publiÃ©es.
 * 6. Calculer les ventes de billets confirmÃ©es.
 * 7. Calculer les dons confirmÃ©s.
 * 8. PrÃ©senter les montants par devise.
 * 9. Activer ou dÃ©sactiver le badge bleu.
 * 10. Enregistrer les changements dans AuditLog.
 *
 * Aucun montant fictif.
 * Aucun calcul de conversion inventÃ©.
 * Aucun changement du statut des paiements.
 * Aucun fichier supplÃ©mentaire pour les dÃ©tails.
 *
 * Le frontend affiche les rÃ©sultats
 * dans une fenÃªtre sur /admin/organizers.
 * ============================================================
 */


/* ============================================================
   CONFIGURATION
============================================================ */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_BODY_BYTES = 1024;

const RESPONSE_HEADERS = {
  "Cache-Control":
    "private, no-store, no-cache, must-revalidate",

  Pragma: "no-cache",

  "X-Content-Type-Options": "nosniff",

  "Referrer-Policy": "no-referrer",

  Vary: "Cookie",
} as const;

/*
 * Le nom doit correspondre au cookie
 * rÃ©ellement crÃ©Ã© par la connexion admin.
 *
 * Valeur par dÃ©faut :
 * tikemia_session
 *
 * Si ton application utilise un autre nom,
 * configure TIKEMIA_SESSION_COOKIE_NAME.
 */
const SESSION_COOKIE_NAME =
  "tikemia_admin_session";

/* ============================================================
   TYPES
============================================================ */

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type AdminIdentity = {
  id: string;
  role: "ADMIN" | "SUPER_ADMIN";
};

type MoneyTotal = {
  currency: string;

  ticketSalesMinor: string;

  donationsMinor: string;

  generatedMinor: string;
};

type ApiErrorCode =
  | "INVALID_ORGANIZER_ID"
  | "ORGANIZER_NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INVALID_REQUEST"
  | "INVALID_ORIGIN"
  | "DATABASE_ERROR";

type BadgePatchInput = {
  blueBadgeEnabled: boolean;
};

/* ============================================================
   RÃ‰PONSES JSON
============================================================ */

function json(
  data: Record<string, unknown>,
  status = 200
): NextResponse {
  return NextResponse.json(data, {
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
   VALIDATION UUID
============================================================ */

function isUuid(
  value: unknown
): value is string {
  return (
    typeof value === "string" &&
    UUID_PATTERN.test(value)
  );
}

/* ============================================================
   AUTHENTIFICATION ADMINISTRATEUR
============================================================ */

/**
 * Le modÃ¨le Session de ton Prisma contient :
 *
 * - tokenHash
 * - userId
 * - expiresAt
 * - revokedAt
 *
 * Le modÃ¨le UserRole contient :
 *
 * - ADMIN
 * - SUPER_ADMIN
 *
 * Cette fonction utilise un cookie de session
 * HTTP-only dont l'empreinte SHA-256 est stockÃ©e
 * dans Session.tokenHash.
 *
 * IMPORTANT :
 *
 * Ce calcul doit Ãªtre identique Ã  celui de ton
 * systÃ¨me de connexion administrateur existant.
 *
 * Le cookie seul ne donne pas de droits :
 * l'utilisateur, ses rÃ´les et sa session
 * sont vÃ©rifiÃ©s dans PostgreSQL.
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

  const user = session.user;

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
   SÃ‰CURITÃ‰ DES MODIFICATIONS
============================================================ */

/**
 * VÃ©rifie que la requÃªte PATCH provient
 * du mÃªme domaine que TIKEMIA.
 *
 * Une requÃªte sans Origin est refusÃ©e.
 *
 * Le frontend doit utiliser :
 * credentials: "same-origin"
 */

function hasValidOrigin(
  request: NextRequest
): boolean {
  const origin =
    request.headers.get("origin");

  if (!origin) {
    return false;
  }

  try {
    const incoming =
      new URL(origin);

    const host =
      request.headers.get("host");

    if (!host) {
      return false;
    }

    /*
     * Le protocole rÃ©el est dÃ©terminÃ©
     * par l'URL publique de la requÃªte.
     *
     * Pour la production, le dÃ©ploiement
     * doit Ãªtre servi en HTTPS.
     */

    const expected =
      new URL(request.url);

    return (
      incoming.origin ===
        expected.origin &&
      incoming.host === host
    );
  } catch {
    return false;
  }
}

/* ============================================================
   VALIDATION DU PATCH
============================================================ */

function isValidPatch(
  value: unknown
): value is BadgePatchInput {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return false;
  }

  const record =
    value as Record<string, unknown>;

  const keys =
    Object.keys(record);

  return (
    keys.length === 1 &&
    keys[0] === "blueBadgeEnabled" &&
    typeof record.blueBadgeEnabled ===
      "boolean"
  );
}

/* ============================================================
   AGRÃ‰GATION DES MONTANTS
============================================================ */

/**
 * Les montants restent en unitÃ©s mineures.
 *
 * Exemple :
 *
 * XOF : 15000 = 15 000 FCFA
 * EUR : 15000 = 150,00 EUR
 *
 * Les devises ne sont jamais additionnÃ©es
 * entre elles.
 */

function buildMoneyTotals(
  sales: ReadonlyArray<{
    currency: string;
    amount: bigint;
  }>,

  donations: ReadonlyArray<{
    currency: string;
    amount: bigint;
  }>
): MoneyTotal[] {
  const map =
    new Map<
      string,
      {
        ticketSales: bigint;
        donations: bigint;
      }
    >();

  function getEntry(currency: string) {
    const existing =
      map.get(currency);

    if (existing) {
      return existing;
    }

    const entry = {
      ticketSales: 0n,
      donations: 0n,
    };

    map.set(currency, entry);

    return entry;
  }

  for (const sale of sales) {
    const entry =
      getEntry(sale.currency);

    entry.ticketSales +=
      sale.amount;
  }

  for (const donation of donations) {
    const entry =
      getEntry(donation.currency);

    entry.donations +=
      donation.amount;
  }

  return [...map.entries()]
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
}

/* ============================================================
   GET â€” DÃ‰TAILS DE L'ORGANISATEUR
============================================================ */

/**
 * GET /api/admin/organizers/:id
 *
 * Lecture directe PostgreSQL.
 *
 * Les chiffres sont calculÃ©s Ã  la demande.
 * Aucune donnÃ©e financiÃ¨re simulÃ©e.
 *
 * "ticketSalesMinor" reprÃ©sente le
 * montant brut des lignes de commandes
 * confirmÃ©es, avant retenues financiÃ¨res.
 *
 * "donationsMinor" reprÃ©sente les dons
 * confirmÃ©s associÃ©s aux cagnottes.
 *
 * Les montants ne reprÃ©sentent pas
 * le solde disponible pour retrait.
 */

export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    /* --------------------------------------------------------
       AUTHENTIFICATION
    -------------------------------------------------------- */

    const admin =
      await authenticateAdmin(request);

    if (!admin) {
      return errorResponse(
        "UNAUTHORIZED",
        401
      );
    }

    /* --------------------------------------------------------
       IDENTIFIANT
    -------------------------------------------------------- */

    const { id } =
      await context.params;

    if (!isUuid(id)) {
      return errorResponse(
        "INVALID_ORGANIZER_ID",
        400
      );
    }

    /* --------------------------------------------------------
       POSTGRESQL
    -------------------------------------------------------- */

    const prisma =
      getPlatformPrisma();

    const organization =
      await prisma.organization.findUnique({
        where: {
          id,
        },

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

              countryCode: true,

              isActive: true,
              isBlocked: true,
            },
          },

          verification: {
            select: {
              status: true,
              verifiedAt: true,
            },
          },

          _count: {
            select: {
              events: true,
              campaigns: true,
            },
          },
        },
      });

    if (!organization) {
      return errorResponse(
        "ORGANIZER_NOT_FOUND",
        404
      );
    }

    /* --------------------------------------------------------
       STATISTIQUES DES PUBLICATIONS
    -------------------------------------------------------- */

    const [
      publishedEvents,
      publishedCampaigns,
      eventSales,
      confirmedDonations,
    ] = await Promise.all([
      prisma.event.count({
        where: {
          organizationId: id,

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
      }),

      prisma.campaign.count({
        where: {
          organizationId: id,

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
      }),

      /*
       * Ventes :
       *
       * - L'Ã©vÃ©nement appartient
       *   Ã  cette organisation.
       * - La commande est PAID.
       * - La date de paiement existe.
       *
       * Somme des sous-totaux des lignes.
       *
       * Les frais de service TIKEMIA
       * ne sont pas ajoutÃ©s aux ventes
       * de l'organisateur.
       */

      prisma.orderLine.groupBy({
        by: [
          "currency",
        ],

        where: {
          event: {
            organizationId: id,
          },

          order: {
            status: "PAID",

            paidAt: {
              not: null,
            },
          },
        },

        _sum: {
          subtotal: true,
        },
      }),

      /*
       * Dons :
       *
       * - La cagnotte appartient
       *   Ã  l'organisation.
       * - Le don est confirmÃ©.
       * - confirmedAt existe.
       */

      prisma.donation.groupBy({
        by: [
          "currency",
        ],

        where: {
          campaign: {
            organizationId: id,
          },

          status: "CONFIRMED",

          confirmedAt: {
            not: null,
          },
        },

        _sum: {
          amount: true,
        },
      }),
    ]);

    /* --------------------------------------------------------
       NORMALISATION DES MONTANTS
    -------------------------------------------------------- */

    const salesByCurrency =
      eventSales.map(
        (row) => ({
          currency: row.currency,
          amount:
            row._sum.subtotal ?? 0n,
        })
      );

    const donationsByCurrency =
      confirmedDonations.map(
        (row) => ({
          currency: row.currency,
          amount:
            row._sum.amount ?? 0n,
        })
      );

    const destinations = await prisma.payoutDestination.findMany({ where: { organizationId: id, deletedAt: null }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] });
    const withdrawalMethods = destinations.map(({ accountRefEncrypted, ...destination }) => ({ ...destination, accountDetails: decryptWithdrawalDetails(accountRefEncrypted) }));
    const totals =
      buildMoneyTotals(
        salesByCurrency,
        donationsByCurrency
      );

    /* --------------------------------------------------------
       RÃ‰PONSE
    -------------------------------------------------------- */

    return json({
      success: true,

      data: {
        withdrawalMethods,
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
          organization.owner.email,

        phoneE164:
          organization.phoneE164 ??
          organization.owner.phoneE164,

        countryCode:
          organization.countryCode ??
          organization.owner.countryCode,

        city:
          organization.city,

        isActive:
          organization.isActive,

        blueBadgeEnabled:
          organization.blueBadgeEnabled,

        verificationStatus:
          organization.verification?.status ??
          "PENDING",

        verifiedAt:
          organization.verification?.verifiedAt
            ?.toISOString() ?? null,

        owner: {
          id:
            organization.owner.id,

          fullName:
            organization.owner.fullName,

          email:
            organization.owner.email,

          phoneE164:
            organization.owner.phoneE164,

          avatarStorageKey:
            organization.owner.avatarStorageKey,

          isActive:
            organization.owner.isActive,

          isBlocked:
            organization.owner.isBlocked,
        },

        statistics: {
          totalEvents:
            organization._count.events,

          publishedEvents,

          totalCampaigns:
            organization._count.campaigns,

          publishedCampaigns,

          /*
           * Chiffres bruts confirmÃ©s.
           *
           * Les remboursements partiels
           * et ajustements financiers
           * ne sont pas dÃ©duits ici.
           */

          amountBasis:
            "CONFIRMED_GROSS",

          totalsByCurrency:
            totals,
        },

        createdAt:
          organization.createdAt.toISOString(),

        updatedAt:
          organization.updatedAt.toISOString(),

        refreshedAt:
          new Date().toISOString(),
      },
    });
  } catch (error) {
    unstable_rethrow(error);
    console.error(
      "[TIKEMIA_ADMIN_ORGANIZER_GET]",
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
   PATCH â€” ACTIVATION DU BADGE BLEU
============================================================ */

/**
 * PATCH /api/admin/organizers/:id
 *
 * Corps JSON :
 *
 * {
 *   "blueBadgeEnabled": true
 * }
 *
 * ou :
 *
 * {
 *   "blueBadgeEnabled": false
 * }
 *
 * Aucune autre modification du profil
 * n'est autorisÃ©e par cette route.
 *
 * Le badge est enregistrÃ© directement
 * dans Organization.blueBadgeEnabled.
 *
 * AuditLog enregistre :
 * - L'administrateur
 * - L'organisation
 * - L'ancien Ã©tat
 * - Le nouvel Ã©tat
 * - La date de l'action
 */

export async function PATCH(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    /* --------------------------------------------------------
       AUTHENTIFICATION
    -------------------------------------------------------- */

    const admin =
      await authenticateAdmin(request);

    if (!admin) {
      return errorResponse(
        "UNAUTHORIZED",
        401
      );
    }

    /* --------------------------------------------------------
       ORIGINE
    -------------------------------------------------------- */

    if (!hasValidOrigin(request)) {
      return errorResponse(
        "INVALID_ORIGIN",
        403
      );
    }

    /* --------------------------------------------------------
       IDENTIFIANT
    -------------------------------------------------------- */

    const { id } =
      await context.params;

    if (!isUuid(id)) {
      return errorResponse(
        "INVALID_ORGANIZER_ID",
        400
      );
    }

    /* --------------------------------------------------------
       VALIDATION DU CONTENU
    -------------------------------------------------------- */

    const contentType =
      request.headers.get(
        "content-type"
      ) ?? "";

    if (
      !contentType
        .toLowerCase()
        .startsWith("application/json")
    ) {
      return errorResponse(
        "INVALID_REQUEST",
        400
      );
    }

    const rawBody = await readBoundedJson(request);
    if (rawBody === null) { return errorResponse("INVALID_REQUEST", 413); }

    if (
      Buffer.byteLength(
        rawBody,
        "utf8"
      ) > MAX_BODY_BYTES
    ) {
      return errorResponse(
        "INVALID_REQUEST",
        400
      );
    }

    let payload: unknown;

    try {
      payload = JSON.parse(
        rawBody
      );
    } catch {
      return errorResponse(
        "INVALID_REQUEST",
        400
      );
    }

    if (!isValidPatch(payload)) {
      return errorResponse(
        "INVALID_REQUEST",
        400
      );
    }

    const enabled =
      payload.blueBadgeEnabled;

    /* --------------------------------------------------------
       TRANSACTION POSTGRESQL
    -------------------------------------------------------- */

    const prisma =
      getPlatformPrisma();

    const result =
      await prisma.$transaction(
        async (tx) => {
          /*
           * Verrouiller la ligne concernÃ©e
           * pour Ã©viter deux modifications
           * simultanÃ©es contradictoires.
           */

          const rows =
            await tx.$queryRaw<
              Array<{ id: string }>
            >`
              SELECT "id"
              FROM "Organization"
              WHERE "id" = ${id}::uuid
              FOR UPDATE
            `;

          if (rows.length !== 1) {
            return null;
          }

          const existing =
            await tx.organization.findUnique({
              where: {
                id,
              },

              select: {
                id: true,
                name: true,
                blueBadgeEnabled: true,
              },
            });

          if (!existing) {
            return null;
          }

          const previous =
            existing.blueBadgeEnabled;

          /*
           * Si le badge est dÃ©jÃ  dans
           * l'Ã©tat demandÃ©, aucune
           * modification inutile.
           */

          if (previous === enabled) {
            return {
              id: existing.id,
              name: existing.name,

              blueBadgeEnabled:
                previous,

              changed: false,

              updatedAt: null as
                | Date
                | null,
            };
          }

          /* -----------------------------------------------
             MODIFICATION DU BADGE
          ----------------------------------------------- */

          const updated =
            await tx.organization.update({
              where: {
                id,
              },

              data: {
                blueBadgeEnabled:
                  enabled,
              },

              select: {
                id: true,
                name: true,
                blueBadgeEnabled: true,
                updatedAt: true,
              },
            });

          /* -----------------------------------------------
             AUDIT ADMINISTRATEUR
          ----------------------------------------------- */

          await tx.auditLog.create({
            data: {
              actorId:
                admin.id,

              action:
                enabled
                  ? "ORGANIZER_BLUE_BADGE_ENABLED"
                  : "ORGANIZER_BLUE_BADGE_DISABLED",

              entity:
                "Organization",

              entityId:
                updated.id,

              metadata: {
                previousValue:
                  previous,

                newValue:
                  enabled,

                actorRole:
                  admin.role,
              },
            },
          });

          return {
            id:
              updated.id,

            name:
              updated.name,

            blueBadgeEnabled:
              updated.blueBadgeEnabled,

            changed:
              true,

            updatedAt:
              updated.updatedAt,
          };
        }
      );

    if (!result) {
      return errorResponse(
        "ORGANIZER_NOT_FOUND",
        404
      );
    }

    /* --------------------------------------------------------
       RÃ‰PONSE
    -------------------------------------------------------- */

    return json({
      success: true,

      data: {
        id:
          result.id,

        name:
          result.name,

        blueBadgeEnabled:
          result.blueBadgeEnabled,

        changed:
          result.changed,

        updatedAt:
          result.updatedAt
            ?.toISOString() ?? null,
      },
    });
  } catch (error) {
    unstable_rethrow(error);
    console.error(
      "[TIKEMIA_ADMIN_ORGANIZER_PATCH]",
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


async function readBoundedJson(request: NextRequest): Promise<string | null> {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); return null; }
      chunks.push(part.value);
    }
    return Buffer.concat(chunks).toString("utf8");
  } catch { return null; } finally { reader.releaseLock(); }
}
