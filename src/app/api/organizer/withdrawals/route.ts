import { getTrustedRequestOrigin } from "@/lib/tikemia-pay/providers";
import { getPlatformPrisma } from "@/lib/payments/fulfillment";
import { isSupportedCurrency } from "@/i18n/config";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createHash,
} from "node:crypto";

import {
  Prisma,
  PrismaClient,
} from "@/generated/prisma/client";

/* ==========================================================
   TIKEMIA — RETRAITS ORGANISATEUR

   GET :
   - Solde financier réel
   - Commission globale de 5 %
   - Montant net
   - Montant disponible
   - Retraits en cours
   - Historique paginé

   POST :
   - Demande de retrait
   - Vérification du propriétaire
   - Moyen de retrait obligatoirement validé
   - Contrôle de devise
   - Contrôle du solde disponible
   - Protection contre les demandes répétées
   - Transaction PostgreSQL sérialisable
   - Enregistrement pour l'administration

   AUCUN TRANSFERT D'ARGENT N'EST
   EXÉCUTÉ PAR CETTE ROUTE.

   Compatible Next.js App Router / Prisma 7.
========================================================== */


/* ==========================================================
   CONFIGURATION
========================================================== */

const SESSION_COOKIE = "tikemia_organizer_session";

const SESSION_PATTERN = /^[a-f0-9]{64}$/i;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const IDEMPOTENCY_PATTERN = /^[a-zA-Z0-9_-]{8,128}$/;

const MAX_BODY_BYTES = 4096;

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

const PLATFORM_FEE_BPS = 500n;
const BPS_DENOMINATOR = 10000n;

const MIN_WITHDRAWAL_MINOR = 1n;

/*
 * Ces statuts réservent des fonds.
 * Une demande en cours réduit donc
 * immédiatement le solde disponible.
 */

const PENDING_STATUSES = [
  "REQUESTED",
  "UNDER_REVIEW",
  "APPROVED",
  "PROCESSING",
] as const;

/*
 * Les retraits COMPLETED sont définitivement
 * déduits du solde financier.
 *
 * Les retraits FAILED / REJECTED / CANCELLED
 * ne bloquent plus le solde.
 */

type Language = "fr" | "en";

type JsonObject = Record<string, unknown>;

type Organizer = {
  userId: string;
  organizationIds: string[];
};

type Organization = {
  id: string;
  name: string;
};

type Balance = {
  currency: string;
  ticketGross: bigint;
  donationGross: bigint;
  gross: bigint;
  refunds: bigint;
  commissionBase: bigint;
  commission: bigint;
  otherFees: bigint;
  adjustments: bigint;
  net: bigint;
  pending: bigint;
  completed: bigint;
  available: bigint;
  transactionCount: number;
};

type ErrorKey =
  | "unauthorized"
  | "forbidden"
  | "invalidRequest"
  | "invalidOrganization"
  | "invalidDestination"
  | "destinationNotVerified"
  | "invalidCurrency"
  | "invalidAmount"
  | "insufficientBalance"
  | "idempotencyRequired"
  | "idempotencyConflict"
  | "tooManyRequests"
  | "conflict"
  | "serverError";

class ApiError extends Error {
  constructor(
    public readonly key: ErrorKey,
    public readonly statusCode: number
  ) {
    super(key);
    this.name = "ApiError";
  }
}

/* ==========================================================
   TRADUCTIONS
========================================================== */

const TEXT = {
  fr: {
    unauthorized:
      "Veuillez vous connecter à votre espace organisateur.",

    forbidden:
      "Cette opération n'est pas autorisée.",

    invalidRequest:
      "Les informations envoyées sont invalides.",

    invalidOrganization:
      "L'organisation sélectionnée est invalide.",

    invalidDestination:
      "Le moyen de retrait sélectionné est invalide.",

    destinationNotVerified:
      "Vous devez d'abord valider ce moyen de retrait.",

    invalidCurrency:
      "La devise sélectionnée est invalide.",

    invalidAmount:
      "Veuillez saisir un montant de retrait valide.",

    insufficientBalance:
      "Le montant demandé dépasse votre solde disponible.",

    idempotencyRequired:
      "Un identifiant unique de demande est nécessaire.",

    idempotencyConflict:
      "Cet identifiant de demande a déjà été utilisé pour un autre retrait.",

    tooManyRequests:
      "Trop de demandes de retrait. Veuillez réessayer plus tard.",

    conflict:
      "Votre solde a changé. Actualisez la page puis réessayez.",

    serverError:
      "Impossible de traiter les retraits pour le moment.",

    loaded:
      "Informations de retrait récupérées avec succès.",

    requested:
      "Votre demande de retrait a été enregistrée. Elle sera examinée par l'administration.",
  },

  en: {
    unauthorized:
      "Please sign in to your organizer account.",

    forbidden:
      "This operation is not authorized.",

    invalidRequest:
      "Invalid request data.",

    invalidOrganization:
      "Invalid organization.",

    invalidDestination:
      "Invalid withdrawal method.",

    destinationNotVerified:
      "You must verify this withdrawal method first.",

    invalidCurrency:
      "Invalid currency.",

    invalidAmount:
      "Please enter a valid withdrawal amount.",

    insufficientBalance:
      "The requested amount exceeds your available balance.",

    idempotencyRequired:
      "A unique request identifier is required.",

    idempotencyConflict:
      "This request identifier has already been used for another withdrawal.",

    tooManyRequests:
      "Too many withdrawal requests. Please try again later.",

    conflict:
      "Your balance has changed. Refresh the page and try again.",

    serverError:
      "Unable to process withdrawals right now.",

    loaded:
      "Withdrawal information retrieved successfully.",

    requested:
      "Your withdrawal request has been recorded and will be reviewed by the administration.",
  },
} as const;

/* ==========================================================
   PRISMA 7
========================================================== */

const getPrisma = getPlatformPrisma;

/* ==========================================================
   RÉPONSES
========================================================== */

function getLanguage(request: NextRequest): Language {
  const queryLocale =
    request.nextUrl.searchParams.get("locale");

  if (queryLocale === "fr" || queryLocale === "en") {
    return queryLocale;
  }

  return (
    request.headers.get("accept-language") ?? ""
  ).toLowerCase().startsWith("en")
    ? "en"
    : "fr";
}

function respond(
  data: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control":
        "private, no-store, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      Vary: "Cookie, Accept-Language",
    },
  });
}

function errorResponse(
  language: Language,
  error: ApiError
) {
  return respond(
    {
      success: false,
      message: TEXT[language][error.key],
    },
    error.statusCode
  );
}

/* ==========================================================
   SÉCURITÉ CSRF
========================================================== */

function checkOrigin(request: NextRequest) {
  const fetchSite =
    request.headers.get("sec-fetch-site");

  if (fetchSite && fetchSite !== "same-origin") {
    throw new ApiError("forbidden", 403);
  }

  const origin = request.headers.get("origin");

  if (!origin) {
    throw new ApiError("forbidden", 403);
  }

  try {
    if (
      new URL(origin).origin !== getTrustedRequestOrigin(request)
    ) {
      throw new ApiError("forbidden", 403);
    }
  } catch {
    throw new ApiError("forbidden", 403);
  }
}

/* ==========================================================
   AUTHENTIFICATION ORGANISATEUR

   Même convention de session que les
   autres API organisateur TIKEMIA.
========================================================== */

async function authenticate(
  request: NextRequest,
  prisma: PrismaClient
): Promise<Organizer> {
  const token =
    request.cookies.get(SESSION_COOKIE)?.value;

  if (!token || !SESSION_PATTERN.test(token)) {
    throw new ApiError("unauthorized", 401);
  }

  const tokenHash = createHash("sha256")
    .update(token, "utf8")
    .digest("hex");

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
    throw new ApiError("unauthorized", 401);
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
    throw new ApiError("unauthorized", 401);
  }

  const organizations = await prisma.organization.findMany({
    where: {
      ownerId: user.id,
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  if (organizations.length === 0) {
    throw new ApiError("unauthorized", 401);
  }

  return {
    userId: user.id,
    organizationIds: organizations.map(
      (item) => item.id
    ),
  };
}

/* ==========================================================
   ORGANISATION

   Si l'utilisateur possède plusieurs
   organisations, le POST exige un ID
   explicite pour éviter les confusions.
========================================================== */

async function resolveOrganization(
  tx: Prisma.TransactionClient | PrismaClient,
  organizer: Organizer,
  requestedId?: string
): Promise<Organization> {
  if (
    requestedId &&
    (
      !UUID_PATTERN.test(requestedId) ||
      !organizer.organizationIds.includes(requestedId)
    )
  ) {
    throw new ApiError("invalidOrganization", 403);
  }

  if (
    !requestedId &&
    organizer.organizationIds.length > 1
  ) {
    throw new ApiError("invalidOrganization", 400);
  }

  const id =
    requestedId ?? organizer.organizationIds[0];

  const organization = await tx.organization.findFirst({
    where: {
      id,
      ownerId: organizer.userId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!organization) {
    throw new ApiError("invalidOrganization", 403);
  }

  return organization;
}

/* ==========================================================
   MONTANTS

   Les montants financiers restent des
   BigInt côté serveur.

   Pour la réponse JSON :
   - Valeur numérique si elle est sûre
   - Sinon, chaîne de caractères
   - Version exacte toujours en string

   Unités :
   - XOF / XAF : unités FCFA
   - EUR / USD : centimes
   - Autres devises : unités mineures ISO
========================================================== */

function safeJsonAmount(value: bigint): number | string {
  if (
    value <= BigInt(Number.MAX_SAFE_INTEGER) &&
    value >= BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    return Number(value);
  }

  return value.toString();
}

function minorAmount(value: bigint): string {
  return value.toString();
}

function sumOrZero(value: bigint | null): bigint {
  return value ?? 0n;
}

function positive(value: bigint): bigint {
  return value > 0n ? value : 0n;
}

function absolute(value: bigint): bigint {
  return value < 0n ? -value : value;
}

/*
 * Arrondi au plus proche, sans utiliser
 * de nombres flottants.
 */

function calculateCommission(
  eligibleAmount: bigint
): bigint {
  const base = positive(eligibleAmount);

  return (
    base * PLATFORM_FEE_BPS +
    BPS_DENOMINATOR / 2n
  ) / BPS_DENOMINATOR;
}

/* ==========================================================
   CALCUL CENTRAL DU SOLDE

   Sources :
   FinancialLedgerEntry
   Payout

   Le ledger fournit :
   - TICKET_SALE
   - DONATION
   - REFUND
   - PSP_FEE
   - ADJUSTMENT

   SERVICE_FEE n'est PAS déduit ici,
   puisque la commission globale
   de 5 % est déjà calculée.

   PAYOUT n'est PAS déduit depuis le ledger :
   les retraits sont déduits depuis
   Payout, une seule fois.

   RESERVE et RESERVE_RELEASE ne sont pas
   comptés pour éviter de réserver deux
   fois un retrait déjà en cours.

   IMPORTANT :
   Cette convention doit être identique
   dans le dashboard et l'administration.
========================================================== */

async function calculateBalance(
  tx: Prisma.TransactionClient | PrismaClient,
  organizationId: string,
  currency: string
): Promise<Balance> {
  const ledgerGroups = await tx.financialLedgerEntry.groupBy({
        by: ["type"],
        where: {
          organizationId,
          currency,
        },
        _sum: {
          amount: true,
        },
      });
const payoutGroups = await tx.payout.groupBy({
        by: ["status"],
        where: {
          organizationId,
          currency,
        },
        _sum: {
          amount: true,
        },
      });
const counts = await Promise.all([
 tx.order.count({ where: { currency, status: { in: ["PAID","PARTIALLY_REFUNDED"] }, paidAt: { not: null }, lines: { some: { event: { organizationId } } } } }),
 tx.donation.count({ where: { currency, status: "CONFIRMED", confirmedAt: { not: null }, campaign: { organizationId } } }),
]);
const transactionCount = counts[0] + counts[1];

  const [paidSales, paidDonations] = await Promise.all([
    tx.orderLine.aggregate({ where: { currency, event: { organizationId }, order: { status: { in: ["PAID", "PARTIALLY_REFUNDED"] }, paidAt: { not: null } } }, _sum: { subtotal: true } }),
    tx.donation.aggregate({ where: { currency, campaign: { organizationId }, status: "CONFIRMED", confirmedAt: { not: null } }, _sum: { amount: true } }),
  ]);
  const totals = new Map<string, bigint>();

  for (const item of ledgerGroups) {
    totals.set(
      item.type,
      sumOrZero(item._sum.amount)
    );
  }

  const ticketGross = positive(
    paidSales._sum.subtotal ?? 0n
  );

  const donationGross = positive(
    paidDonations._sum.amount ?? 0n
  );

  const gross = ticketGross + donationGross;

  /*
   * Les remboursements et les frais
   * techniques sont des débits.
   *
   * Le signe négatif est prévu dans
   * FinancialLedgerEntry.
   */

  const refunds = absolute(
    totals.get("REFUND") ?? 0n
  );

  const otherFees = absolute(
    totals.get("PSP_FEE") ?? 0n
  );

  const adjustments =
    totals.get("ADJUSTMENT") ?? 0n;

  /*
   * Commission TIKEMIA :
   * 5 % des revenus non remboursés.
   */

  const commissionBase = positive(
    gross - refunds
  );

  const commission = calculateCommission(
    commissionBase
  );

  const net =
    gross -
    refunds -
    commission -
    otherFees +
    adjustments;

  let pending = 0n;
  let completed = 0n;

  for (const item of payoutGroups) {
    const amount = positive(
      sumOrZero(item._sum.amount)
    );

    if (
      PENDING_STATUSES.includes(
        item.status as (typeof PENDING_STATUSES)[number]
      )
    ) {
      pending += amount;
    }

    if (item.status === "COMPLETED") {
      completed += amount;
    }
  }

  /*
   * Les montants en cours sont déjà
   * indisponibles pour un autre retrait.
   */

  const available = positive(
    net - pending - completed
  );

  return {
    currency,
    ticketGross,
    donationGross,
    gross,
    refunds,
    commissionBase,
    commission,
    otherFees,
    adjustments,
    net,
    pending,
    completed,
    available,
    transactionCount,
  };
}

/* ==========================================================
   SÉRIALISATION DU SOLDE

   On fournit les noms classiques
   utilisés par une interface dashboard.
========================================================== */

function serializeBalance(balance: Balance) {
  return {
    currency: balance.currency,

    gross: safeJsonAmount(balance.gross),

    ticketGross: safeJsonAmount(
      balance.ticketGross
    ),

    donationGross: safeJsonAmount(
      balance.donationGross
    ),

    refunds: safeJsonAmount(
      balance.refunds
    ),

    commissionRate: 5,

    commission: safeJsonAmount(
      balance.commission
    ),

    platformFee: safeJsonAmount(
      balance.commission
    ),

    otherFees: safeJsonAmount(
      balance.otherFees
    ),

    net: safeJsonAmount(balance.net),

    pending: safeJsonAmount(
      balance.pending
    ),

    completed: safeJsonAmount(
      balance.completed
    ),

    available: safeJsonAmount(
      balance.available
    ),

    transactionCount:
      balance.transactionCount,

    /*
     * Versions exactes en unités mineures.
     * Utilisables pour les traitements
     * financiers sans virgule flottante.
     */

    minor: {
      gross: minorAmount(balance.gross),
      commission: minorAmount(
        balance.commission
      ),
      net: minorAmount(balance.net),
      pending: minorAmount(
        balance.pending
      ),
      completed: minorAmount(
        balance.completed
      ),
      available: minorAmount(
        balance.available
      ),
    },
  };
}

/* ==========================================================
   VALIDATION
========================================================== */

function parseCurrency(
  value: unknown
): string { if (typeof value !== "string") throw new ApiError("invalidCurrency", 400); const currency = value.trim().toUpperCase(); if (!isSupportedCurrency(currency)) throw new ApiError("invalidCurrency", 400); return currency; }

function parseAmount(
  value: unknown
): bigint {
  const text =
    typeof value === "number"
      ? Number.isSafeInteger(value)
        ? String(value)
        : ""
      : typeof value === "string"
        ? value.trim()
        : "";

  if (!/^[1-9]\d{0,17}$/.test(text)) {
    throw new ApiError("invalidAmount", 400);
  }

  const amount = BigInt(text);

  if (amount < MIN_WITHDRAWAL_MINOR) {
    throw new ApiError("invalidAmount", 400);
  }

  return amount;
}

function parsePage(
  value: string | null,
  fallback: number,
  max: number
): number {
  if (!value) return fallback;

  if (!/^\d{1,7}$/.test(value)) {
    throw new ApiError("invalidRequest", 400);
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new ApiError("invalidRequest", 400);
  }

  return Math.min(parsed, max);
}

async function readJson(
  request: NextRequest
): Promise<JsonObject> {
  const contentType =
    request.headers.get("content-type") ?? "";

  if (
    !contentType.toLowerCase().startsWith(
      "application/json"
    )
  ) {
    throw new ApiError("invalidRequest", 400);
  }

  if (!request.body) {
    throw new ApiError("invalidRequest", 400);
  }

  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const chunk = await reader.read();

      if (chunk.done) break;

      total += chunk.value.byteLength;

      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new ApiError("invalidRequest", 400);
      }

      parts.push(chunk.value);
    }

    const bytes = new Uint8Array(total);
    let offset = 0;

    for (const part of parts) {
      bytes.set(part, offset);
      offset += part.byteLength;
    }

    const parsed: unknown = JSON.parse(
      new TextDecoder("utf-8", {
        fatal: true,
      }).decode(bytes)
    );

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      throw new ApiError("invalidRequest", 400);
    }

    return parsed as JsonObject;
  } catch (error) {
    if (error instanceof ApiError) throw error;

    throw new ApiError("invalidRequest", 400);
  } finally {
    reader.releaseLock();
  }
}

/* ==========================================================
   FORMAT DE L'HISTORIQUE
========================================================== */

function serializePayout(
  payout: {
    id: string;
    reference: string;
    organizationId: string;
    destinationId: string;
    purpose: string;
    amount: bigint;
    currency: string;
    status: string;
    requestedAt: Date;
    completedAt: Date | null;
    updatedAt: Date;
    destination: {
      provider: string;
      type: string;
      accountName: string;
      maskedAccountRef: string | null;
      bankName: string | null;
      assetCode: string | null;
      networkCode: string | null;
    };
  }
) {
  return {
    id: payout.id,
    reference: payout.reference,
    organizationId: payout.organizationId,
    destinationId: payout.destinationId,
    purpose: payout.purpose,

    amount: safeJsonAmount(
      payout.amount
    ),

    amountMinor: payout.amount.toString(),

    currency: payout.currency,
    status: payout.status,

    requestedAt:
      payout.requestedAt.toISOString(),

    completedAt:
      payout.completedAt?.toISOString() ?? null,

    updatedAt:
      payout.updatedAt.toISOString(),

    destination: {
      provider: payout.destination.provider,
      type: payout.destination.type,
      accountName:
        payout.destination.accountName,
      maskedAccountRef:
        payout.destination.maskedAccountRef,
      bankName: payout.destination.bankName,
      assetCode: payout.destination.assetCode,
      networkCode:
        payout.destination.networkCode,
    },
  };
}

/* ==========================================================
   IDENTIFIANT DE DEMANDE

   Une même clé d'idempotence correspond
   toujours à la même référence.

   Cela empêche un double clic ou une
   répétition réseau de créer deux retraits.

   Le frontend doit fournir :
   Idempotency-Key: crypto.randomUUID()
========================================================== */

function getIdempotencyKey(
  request: NextRequest,
  body: JsonObject
): string {
  const candidate =
    request.headers.get("idempotency-key") ??
    body.idempotencyKey;

  if (
    typeof candidate !== "string" ||
    !IDEMPOTENCY_PATTERN.test(candidate)
  ) {
    throw new ApiError("idempotencyRequired", 400);
  }

  return candidate;
}

function makePayoutReference(
  organizationId: string,
  userId: string,
  idempotencyKey: string
): string {
  const digest = createHash("sha256")
    .update(
      [
        "TIKEMIA_PAYOUT_V1",
        organizationId,
        userId,
        idempotencyKey,
      ].join(":")
    )
    .digest("hex")
    .slice(0, 28)
    .toUpperCase();

  return `RET-${digest}`;
}

/* ==========================================================
   ERREURS
========================================================== */

function handleError(
  error: unknown,
  language: Language
) {
  if (error instanceof ApiError) {
    return errorResponse(language, error);
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError
  ) {
    if (
      error.code === "P2034" ||
      error.code === "P2002"
    ) {
      return errorResponse(
        language,
        new ApiError("conflict", 409)
      );
    }
  }

  console.error(
    "[TIKEMIA WITHDRAWALS]",
    error instanceof Error
      ? error.name
      : "UnknownError"
  );

  return errorResponse(
    language,
    new ApiError("serverError", 503)
  );
}

/* ==========================================================
   GET — SOLDE ET HISTORIQUE

   Exemples :

   /api/organizer/withdrawals
   /api/organizer/withdrawals?currency=XOF
   /api/organizer/withdrawals?organizationId=UUID

   Paramètres :
   - organizationId
   - currency
   - page
   - pageSize

   Toutes les données proviennent
   de PostgreSQL.
========================================================== */

export async function GET(request: NextRequest) {
  const language = getLanguage(request);

  try {
    const prisma = getPrisma();

    const organizer = await authenticate(
      request,
      prisma
    );

    const params = request.nextUrl.searchParams;

    const requestedOrganization =
      params.get("organizationId") ?? undefined;

    const currency = parseCurrency(
      params.get("currency") ?? "XOF"
    );

    const page = parsePage(
      params.get("page"),
      1,
      1_000_000
    );

    const pageSize = parsePage(
      params.get("pageSize"),
      DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE
    );

    const organization = await resolveOrganization(
      prisma,
      organizer,
      requestedOrganization ?? (params.get("view") === "transactions" ? organizer.organizationIds[0] : undefined)
    );

    const [balance, payouts, total] =
      await prisma.$transaction(
        async (tx) => {
          const calculated = await calculateBalance(
            tx,
            organization.id,
            currency
          );

          const where: Prisma.PayoutWhereInput = {
            organizationId: params.get("view") === "transactions" && !requestedOrganization ? { in: organizer.organizationIds } : organization.id,
            ...(request.nextUrl.searchParams.get("view") === "transactions" ? {} : { currency }),
          };

          const history = await tx.payout.findMany({
              where,
              orderBy: [
                { requestedAt: "desc" },
                { id: "desc" },
              ],
              skip: (page - 1) * pageSize,
              take: pageSize,
              select: {
                id: true,
                reference: true,
                organizationId: true,
                destinationId: true,
                purpose: true,
                amount: true,
                currency: true,
                status: true,
                requestedAt: true,
                completedAt: true,
                updatedAt: true,
                destination: {
                  select: {
                    provider: true,
                    type: true,
                    accountName: true,
                    maskedAccountRef: true,
                    bankName: true,
                    assetCode: true,
                    networkCode: true,
                  },
                },
              },
            });
const count = await tx.payout.count({
              where,
            });

          return [calculated, history, count] as const;
        },
        {
          isolationLevel:
            Prisma.TransactionIsolationLevel.RepeatableRead,
          timeout: 15000,
        }
      );

    const serializedBalance =
      serializeBalance(balance);

    const history = payouts.map(
      serializePayout
    );

    return respond({
      success: true,
      message: TEXT[language].loaded,

      organization: {
        id: organization.id,
        name: organization.name,
      },

      currency,

      balance: serializedBalance,

      summary: serializedBalance,

      withdrawals: history,

      history,

      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(
          1,
          Math.ceil(total / pageSize)
        ),
        hasNext:
          page * pageSize < total,
        hasPrevious:
          page > 1,
      },

      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return handleError(error, language);
  }
}

/* ==========================================================
   POST — DEMANDER UN RETRAIT

   JSON :

   {
     "organizationId": "UUID",
     "destinationId": "UUID",
     "amount": "500000",
     "currency": "XOF",
     "idempotencyKey": "UUID-UNIQUE"
   }

   amount :
   unités monétaires mineures.

   Pour XOF :
   500000 = 500 000 FCFA.

   Le serveur ne prélève pas de nouveaux
   frais lors de la demande.

   Le traitement définitif appartient
   à l'administration TIKEMIA.
========================================================== */

export async function POST(request: NextRequest) {
  const language = getLanguage(request);

  try {
    checkOrigin(request);

    const prisma = getPrisma();

    const organizer = await authenticate(
      request,
      prisma
    );

    const body = await readJson(request);

    const organizationId =
      typeof body.organizationId === "string"
        ? body.organizationId
        : undefined;

    if (
      typeof body.destinationId !== "string" ||
      !UUID_PATTERN.test(body.destinationId)
    ) {
      throw new ApiError("invalidDestination", 400);
    }

    const destinationId =
      body.destinationId.toLowerCase();

    const currency = parseCurrency(body.currency);

    const amount = parseAmount(body.amount);

    const idempotencyKey = getIdempotencyKey(
      request,
      body
    );

    const organization = await resolveOrganization(
      prisma,
      organizer,
      organizationId
    );

    const reference = makePayoutReference(
      organization.id,
      organizer.userId,
      idempotencyKey
    );

    /*
     * La transaction verrouille le couple
     * organisation / devise.
     *
     * Deux demandes concurrentes ne peuvent
     * pas utiliser le même solde disponible.
     */

    const result = await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext(${organization.id + ":" + currency}))) AS lock_row
        `;

        /* -----------------------------------------------
           Vérifier si cette demande existe déjà.
        ----------------------------------------------- */

        const existing = await tx.payout.findUnique({
          where: {
            reference,
          },
          select: {
            id: true,
            reference: true,
            organizationId: true,
            destinationId: true,
            purpose: true,
            amount: true,
            currency: true,
            status: true,
            requestedAt: true,
            completedAt: true,
            updatedAt: true,
            destination: {
              select: {
                provider: true,
                type: true,
                accountName: true,
                maskedAccountRef: true,
                bankName: true,
                assetCode: true,
                networkCode: true,
              },
            },
          },
        });

        if (existing) {
          if (
            existing.organizationId !== organization.id ||
            existing.destinationId !== destinationId ||
            existing.amount !== amount ||
            existing.currency !== currency
          ) {
            throw new ApiError(
              "idempotencyConflict",
              409
            );
          }

          return {
            payout: existing,
            alreadyCreated: true,
            balance: await calculateBalance(
              tx,
              organization.id,
              currency
            ),
          };
        }

        /* -----------------------------------------------
           Moyen de retrait :
           - Organisation propriétaire
           - Actif
           - Non supprimé
           - Validé par OTP
           - Même devise
        ----------------------------------------------- */

        const destination =
          await tx.payoutDestination.findFirst({
            where: {
              id: destinationId,
              organizationId: organization.id,
              isActive: true,
              deletedAt: null,
            },
            select: {
              id: true,
              currency: true,
              isVerified: true,
              verifiedAt: true,
            },
          });

        if (!destination) {
          throw new ApiError(
            "invalidDestination",
            404
          );
        }

        if (
          !destination.isVerified ||
          !destination.verifiedAt
        ) {
          throw new ApiError(
            "destinationNotVerified",
            403
          );
        }

        if (destination.currency !== currency) {
          throw new ApiError(
            "invalidCurrency",
            400
          );
        }

        /* -----------------------------------------------
           Contrôle serveur du solde.
        ----------------------------------------------- */

        const before = await calculateBalance(
          tx,
          organization.id,
          currency
        );

        if (amount > before.available) {
          throw new ApiError(
            "insufficientBalance",
            409
          );
        }

        /* -----------------------------------------------
           Contrôle de fréquence simple :
           maximum cinq demandes actives.

           Cela évite d'accumuler des dizaines
           de demandes simultanées.
        ----------------------------------------------- */

        const pendingCount = await tx.payout.count({
          where: {
            organizationId: organization.id,
            currency,
            status: {
              in: [...PENDING_STATUSES],
            },
          },
        });

        if (pendingCount >= 5) {
          throw new ApiError(
            "tooManyRequests",
            429
          );
        }

        /* -----------------------------------------------
           L'ancien schéma impose un PayoutPurpose.

           Pour les recettes uniquement issues de
           cagnottes : CAMPAIGN_FUNDS.

           Sinon : EVENT_REVENUE.

           Le solde reste global à l'organisation,
           quelle que soit cette classification.
        ----------------------------------------------- */

        const purpose =
          before.ticketGross === 0n &&
          before.donationGross > 0n
            ? "CAMPAIGN_FUNDS"
            : "EVENT_REVENUE";

        /* -----------------------------------------------
           Créer une demande de retrait.

           Aucun appel à un PSP n'est effectué.
        ----------------------------------------------- */

        const payout = await tx.payout.create({
          data: {
            reference,
            organizationId: organization.id,
            destinationId,
            purpose,
            amount,
            currency,
            status: "REQUESTED",
          },
          select: {
            id: true,
            reference: true,
            organizationId: true,
            destinationId: true,
            purpose: true,
            amount: true,
            currency: true,
            status: true,
            requestedAt: true,
            completedAt: true,
            updatedAt: true,
            destination: {
              select: {
                provider: true,
                type: true,
                accountName: true,
                maskedAccountRef: true,
                bankName: true,
                assetCode: true,
                networkCode: true,
              },
            },
          },
        });

        /* -----------------------------------------------
           Audit.

           Aucun IBAN, numéro de compte
           ni clé de portefeuille ici.
        ----------------------------------------------- */

        await tx.auditLog.create({
          data: {
            actorId: organizer.userId,
            action: "PAYOUT_REQUESTED",
            entity: "Payout",
            entityId: payout.id,
            metadata: {
              organizationId: organization.id,
              destinationId,
              currency,
              reference,
            },
          },
        });

        await tx.securityEvent.create({
          data: {
            userId: organizer.userId,
            type: "ORGANIZER_PAYOUT_REQUESTED",
            metadata: {
              payoutId: payout.id,
              organizationId: organization.id,
            },
          },
        });

        /*
         * Le Payout REQUESTED est désormais
         * compté dans les fonds en cours.
         */

        const after = await calculateBalance(
          tx,
          organization.id,
          currency
        );

        return {
          payout,
          alreadyCreated: false,
          balance: after,
        };
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel.Serializable,
        timeout: 15000,
      }
    );

    return respond(
      {
        success: true,

        message: TEXT[language].requested,

        alreadyCreated: result.alreadyCreated,

        withdrawal: serializePayout(
          result.payout
        ),

        balance: serializeBalance(
          result.balance
        ),
      },
      result.alreadyCreated ? 200 : 201
    );
  } catch (error) {
    return handleError(error, language);
  }
}
