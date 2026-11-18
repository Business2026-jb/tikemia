import { getPlatformPrisma } from "@/lib/payments/fulfillment";
import {
  isSupportedCurrency,
  SUPPORTED_CURRENCIES,
} from "@/i18n/config";


import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";

import { Prisma, PrismaClient } from "@/generated/prisma/client";

/* ============================================
   TIKEMIA — API DASHBOARD ORGANISATEUR

   GET /api/organizer/dashboard

   Sources :
   - PostgreSQL
   - Prisma ORM 7

   Données :
   - Billets vendus
   - Revenus générés
   - Événements actifs
   - Cagnottes actives
   - Dons confirmés
   - Graphique des ventes
   - Répartition par catégorie
   - Événements en vente
   - Dernières transactions

   Sécurité :
   - Cookie de session
   - Session non révoquée
   - Email vérifié
   - Rôle organisateur
   - Isolation par organisation
   - Contrôle des filtres
   - Aucun résultat fictif
============================================ */


/* ============================================
   CONFIGURATION
============================================ */

const SESSION_COOKIE = "tikemia_organizer_session";

const MAX_CUSTOM_DAYS = 366;

type Language = "fr" | "en";

type DashboardPeriod =
  | "week"
  | "month"
  | "year"
  | "custom";

type DashboardQuickView =
  | "monthly_sales"
  | "ticket_sales"
  | "revenue"
  | "events"
  | "fundraisers";

type DashboardCurrency = (typeof SUPPORTED_CURRENCIES)[number];

type DashboardRange = {
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
  granularity: "day" | "month";
};

type SalesBucket = {
  bucket: string;
  quantity: bigint;
};

type DistributionRow = {
  category: string;
  quantity: bigint;
};

type EventSalesRow = {
  eventId: string;
  quantity: bigint;
};

type ErrorKey =
  | "unauthorized"
  | "forbidden"
  | "invalidPeriod"
  | "invalidDates"
  | "invalidCurrency"
  | "serverError";

/* ============================================
   TRADUCTIONS
============================================ */

const TEXT = {
  fr: {
    unauthorized: "Connexion requise.",
    forbidden: "Accès non autorisé.",
    invalidPeriod: "Période invalide.",
    invalidDates: "Dates personnalisées invalides.",
    invalidCurrency: "Devise invalide.",
    serverError:
      "Impossible de charger le tableau de bord.",
  },

  en: {
    unauthorized: "Authentication required.",
    forbidden: "Access denied.",
    invalidPeriod: "Invalid period.",
    invalidDates: "Invalid custom dates.",
    invalidCurrency: "Invalid currency.",
    serverError:
      "Unable to load dashboard data.",
  },
} as const;

/* ============================================
   PRISMA 7 — CONNEXION
============================================ */



const getPrisma = getPlatformPrisma;

/* ============================================
   RÉPONSES JSON
============================================ */

function jsonResponse(
  data: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control":
        "private, no-store, max-age=0",
      "Pragma": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Vary": "Cookie",
    },
  });
}

function errorResponse(
  language: Language,
  key: ErrorKey,
  status: number
) {
  return jsonResponse(
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

function getLanguage(
  request: NextRequest
): Language {
  const explicit =
    request.nextUrl.searchParams.get("locale");

  if (explicit === "en") {
    return "en";
  }

  if (explicit === "fr") {
    return "fr";
  }

  const header =
    request.headers.get("accept-language") ?? "";

  return header.toLowerCase().startsWith("en")
    ? "en"
    : "fr";
}

/* ============================================
   VALIDATION DES PARAMÈTRES
============================================ */

function parsePeriod(
  value: string | null
): DashboardPeriod | null {
  if (!value) {
    return "month";
  }

  if (
    value === "week" ||
    value === "month" ||
    value === "year" ||
    value === "custom"
  ) {
    return value;
  }

  return null;
}

function parseQuickView(
  value: string | null
): DashboardQuickView | null {
  if (!value) {
    return "monthly_sales";
  }

  if (
    value === "monthly_sales" ||
    value === "ticket_sales" ||
    value === "revenue" ||
    value === "events" ||
    value === "fundraisers"
  ) {
    return value;
  }

  return null;
}

function parseCurrency(
  value: string | null
): DashboardCurrency | null { if (!value) return "XOF"; const currency = value.trim().toUpperCase(); return isSupportedCurrency(currency) ? currency : null; }

function parseCalendarDate(
  value: string | null
): Date | null {
  if (
    !value ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return null;
  }

  const [year, month, day] = value
    .split("-")
    .map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

/* ============================================
   CALCUL DES PÉRIODES

   Toutes les bornes sont en UTC.

   Cette convention évite qu'un filtre
   change selon le navigateur.

   Les dates sont inclusives côté
   utilisateur, avec borne supérieure
   exclusive dans les requêtes.
============================================ */

function getDateRange(
  period: DashboardPeriod,
  startDate: string | null,
  endDate: string | null,
  now: Date
): DashboardRange | null {
  const start = new Date(now);
  let end = new Date(now);
  let granularity: "day" | "month" = "day";

  if (period === "week") {
    const weekday = now.getUTCDay();

    const daysSinceMonday =
      (weekday + 6) % 7;

    start.setUTCDate(
      start.getUTCDate() - daysSinceMonday
    );

    start.setUTCHours(0, 0, 0, 0);

    end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
  }

  if (period === "month") {
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);

    end = new Date(
      Date.UTC(
        start.getUTCFullYear(),
        start.getUTCMonth() + 1,
        1
      )
    );
  }

  if (period === "year") {
    start.setUTCMonth(0, 1);
    start.setUTCHours(0, 0, 0, 0);

    end = new Date(
      Date.UTC(
        start.getUTCFullYear() + 1,
        0,
        1
      )
    );

    granularity = "month";
  }

  if (period === "custom") {
    const customStart =
      parseCalendarDate(startDate);

    const customEnd =
      parseCalendarDate(endDate);

    if (
      !customStart ||
      !customEnd ||
      customEnd < customStart
    ) {
      return null;
    }

    const lastAllowed = new Date(now);
    lastAllowed.setUTCHours(0, 0, 0, 0);

    if (
      customStart > lastAllowed
    ) {
      return null;
    }

    if (customEnd > lastAllowed) customEnd.setTime(lastAllowed.getTime());
    start.setTime(customStart.getTime());

    end = new Date(customEnd);
    end.setUTCDate(end.getUTCDate() + 1);

    const durationDays =
      (end.getTime() - start.getTime()) /
      86400000;

    if (
      durationDays < 1 ||
      durationDays > MAX_CUSTOM_DAYS
    ) {
      return null;
    }

    granularity =
      durationDays > 90 ? "month" : "day";
  }

  const duration =
    end.getTime() - start.getTime();

  const previousEnd = new Date(start);

  const previousStart = period === "month"
    ? new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1))
    : period === "year"
      ? new Date(Date.UTC(start.getUTCFullYear() - 1, 0, 1))
      : new Date(start.getTime() - duration);

  return {
    start,
    end,
    previousStart,
    previousEnd,
    granularity,
  };
}

/* ============================================
   AUTHENTIFICATION ORGANISATEUR

   Le cookie contient le jeton brut.
   La base contient son empreinte SHA-256.

   Seules les organisations dont
   l'utilisateur est propriétaire
   sont utilisées dans cette route.
============================================ */

async function getAuthorizedOrganizer(
  request: NextRequest,
  prisma: PrismaClient
): Promise<{
  userId: string;
  organizationIds: string[];
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

  const session = await prisma.session.findUnique({
    where: {
      tokenHash,
    },
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

  const organizations =
    await prisma.organization.findMany({
      where: {
        ownerId: user.id,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

  if (organizations.length === 0) {
    return null;
  }

  return {
    userId: user.id,
    organizationIds: organizations.map(
      (organization) => organization.id
    ),
  };
}

/* ============================================
   MONTANTS FINANCIERS

   Un montant BigInt est renvoyé comme
   chaîne décimale, jamais comme Number.

   Exemple :
   "250000" pour 250 000 FCFA.

   Les conversions en autres devises
   ne sont pas réalisées ici.
============================================ */

function amountToString(
  value: bigint | null | undefined
): string {
  return (value ?? BigInt(0)).toString();
}

function safeCount(
  value: number | null | undefined
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return 0;
  }

  return Math.max(0, Math.trunc(value));
}

function bigintToSafeNumber(
  value: bigint
): number {
  if (value <= BigInt(0)) {
    return 0;
  }

  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("DASHBOARD_COUNT_OVERFLOW");
  }

  return Number(value);
}

function percentageChange(
  current: number,
  previous: number
): number | null {
  if (previous === 0) {
    return null;
  }

  return Math.round(
    ((current - previous) / previous) *
      10000
  ) / 100;
}

/* ============================================
   CLÉS DES PÉRIODES
============================================ */

function getBucketKey(
  date: Date,
  granularity: "day" | "month"
): string {
  const year = date.getUTCFullYear();

  const month = String(
    date.getUTCMonth() + 1
  ).padStart(2, "0");

  if (granularity === "month") {
    return `${year}-${month}`;
  }

  const day = String(
    date.getUTCDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function buildSalesChart(
  rows: SalesBucket[],
  range: DashboardRange,
  locale: Language
) {
  const totals = new Map<string, number>();

  for (const row of rows) {
    totals.set(
      row.bucket,
      bigintToSafeNumber(row.quantity)
    );
  }

  const points: {
    label: string;
    date: string;
    value: number;
  }[] = [];

  const cursor = new Date(range.start);

  const dateFormatter = new Intl.DateTimeFormat(
    locale === "fr" ? "fr-FR" : "en-GB",
    range.granularity === "month"
      ? {
          month: "short",
          timeZone: "UTC",
        }
      : {
          day: "2-digit",
          month: "short",
          timeZone: "UTC",
        }
  );

  // Pour une période personnalisée agrégée
  // par mois, commencer au premier jour
  // du mois de la borne inférieure.

  if (range.granularity === "month") {
    cursor.setUTCDate(1);
  }

  while (cursor < range.end) {
    const key = getBucketKey(
      cursor,
      range.granularity
    );

    points.push({
      label: dateFormatter.format(cursor),
      date: key,
      value: totals.get(key) ?? 0,
    });

    if (range.granularity === "month") {
      cursor.setUTCMonth(
        cursor.getUTCMonth() + 1
      );
    } else {
      cursor.setUTCDate(
        cursor.getUTCDate() + 1
      );
    }
  }

  return points;
}

/* ============================================
   GET — DASHBOARD
============================================ */

export async function GET(
  request: NextRequest
) {
  const language = getLanguage(request);

  try {
    /* ----------------------------------------
       1. AUTHENTIFICATION
    ---------------------------------------- */

    const prisma = getPrisma();

    const organizer =
      await getAuthorizedOrganizer(
        request,
        prisma
      );

    if (!organizer) {
      return errorResponse(
        language,
        "unauthorized",
        401
      );
    }

    /* ----------------------------------------
       2. FILTRES
    ---------------------------------------- */

    const params = request.nextUrl.searchParams;

    const period = parsePeriod(
      params.get("period")
    );

    const quickView = parseQuickView(
      params.get("quickView")
    );

    if (!period || !quickView) {
      return errorResponse(
        language,
        "invalidPeriod",
        400
      );
    }

    const currency = parseCurrency(
      params.get("currency")
    );

    if (!currency) {
      return errorResponse(
        language,
        "invalidCurrency",
        400
      );
    }

    const now = new Date();

    const range = getDateRange(
      period,
      params.get("startDate"),
      params.get("endDate"),
      now
    );

    if (!range) {
      return errorResponse(
        language,
        "invalidDates",
        400
      );
    }

    const organizationIds =
      organizer.organizationIds;

    if (["sales", "statistics", "transactions"].includes(params.get("view") || "")) {
      const statisticsView = params.get("view") === "statistics";
      const allCurrencies = params.get("view") === "transactions";
      const page = Math.max(1, Math.min(100000, Number(params.get("page")) || 1));
      const pageSize = Math.max(1, Math.min(100, Number(params.get("pageSize")) || 20));
      if (!Number.isInteger(page) || !Number.isInteger(pageSize)) return errorResponse(language, "invalidDates", 400);
      const type = params.get("saleType") || "all";
      const state = params.get("status") || "all";
      const search = (params.get("search") || "").trim().slice(0, 200);
      const orgs = Prisma.join(organizationIds.map(id => Prisma.sql`${id}::uuid`));
      const source = Prisma.sql`WITH sales AS (
        SELECT l."id"::text AS id, o."reference", 'ticket'::text AS type,
          l."eventTitle" AS title, COALESCE(u."fullName", '') AS person,
          COALESCE(o."paidAt", o."createdAt") AS date, l."subtotal" AS amount,
          l."currency", o."status"::text AS status, l."categoryName" AS subtitle,
          l."quantity"::bigint AS quantity, e."id"::text AS "entityId", NULL::bigint AS goal,
          (o."status" = 'PAID' AND o."paidAt" IS NOT NULL) AS paid
        FROM "OrderLine" l JOIN "Order" o ON o."id" = l."orderId"
          JOIN "Event" e ON e."id" = l."eventId" LEFT JOIN "User" u ON u."id" = o."buyerId"
        WHERE e."organizationId" IN (${orgs}) AND l."currency" = o."currency" AND (${allCurrencies} OR l."currency" = ${currency})
        UNION ALL
        SELECT d."id"::text, d."reference", 'donation'::text, c."title",
          CASE WHEN d."isAnonymous" THEN '' ELSE COALESCE(d."donorName", '') END,
          COALESCE(d."confirmedAt", d."createdAt"), d."amount", d."currency", d."status"::text, '', 0::bigint, c."id"::text, c."goalAmount",
          (d."status" = 'CONFIRMED' AND d."confirmedAt" IS NOT NULL)
        FROM "Donation" d JOIN "Campaign" c ON c."id" = d."campaignId"
        WHERE c."organizationId" IN (${orgs}) AND (${allCurrencies} OR d."currency" = ${currency})
      ), filtered AS (
        SELECT * FROM sales WHERE (${allCurrencies} OR (date >= ${range.start} AND date < ${range.end}))
          AND (${type} = 'all' OR type = ${type})
          AND (${state} = 'all' OR (${state} = 'paid' AND paid) OR (${state} = 'other' AND NOT paid))
          AND (${search} = '' OR position(lower(${search}) in lower(title || ' ' || person || ' ' || reference)) > 0)
      )`;
      const sorts: Record<string, Prisma.Sql> = {
        newest: Prisma.sql`date DESC, id DESC`, oldest: Prisma.sql`date ASC, id ASC`,
        amount_desc: Prisma.sql`amount DESC, id ASC`, amount_asc: Prisma.sql`amount ASC, id ASC`,
      };
      const ordering = sorts[params.get("sort") || "newest"] || sorts.newest;
      if (statisticsView) {
        const results = await prisma.$transaction(async tx => {
          const totals = await tx.$queryRaw<{ gross: Prisma.Decimal; tickets: Prisma.Decimal; donations: bigint; ticketGross: Prisma.Decimal; donationGross: Prisma.Decimal }[]>(Prisma.sql`${source} SELECT COALESCE(SUM(amount),0) AS gross, COALESCE(SUM(quantity),0) AS tickets, COUNT(*) FILTER (WHERE type = 'donation') AS donations, COALESCE(SUM(amount) FILTER (WHERE type = 'ticket'),0) AS "ticketGross", COALESCE(SUM(amount) FILTER (WHERE type = 'donation'),0) AS "donationGross" FROM filtered WHERE paid`);
          const series = await tx.$queryRaw<{ date: string; amount: Prisma.Decimal }[]>(Prisma.sql`${source} SELECT to_char(date AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date, SUM(amount) AS amount FROM filtered WHERE paid GROUP BY 1 ORDER BY 1`);
          const performance = await tx.$queryRaw<{ id: string; type: string; title: string; tickets: Prisma.Decimal; amount: Prisma.Decimal; goal: bigint | null }[]>(Prisma.sql`${source} SELECT "entityId" AS id, type, MAX(title) AS title, SUM(quantity) AS tickets, SUM(amount) AS amount, MAX(goal) AS goal FROM filtered WHERE paid GROUP BY "entityId", type ORDER BY amount DESC`);
          return { totals: totals[0], series, performance };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 15000 });
        const gross = BigInt(String(results.totals.gross));
        return jsonResponse({ success: true, summary: { ticketsSold: String(results.totals.tickets), donationsCount: Number(results.totals.donations), grossRevenue: String(gross), platformCommission: String((gross * 5n + 50n) / 100n) },
          revenueBreakdown: { ticketRevenue: String(results.totals.ticketGross), donationRevenue: String(results.totals.donationGross), otherRevenue: "0" },
          revenueSeries: results.series.map(row => ({ date: row.date, amountMinor: String(row.amount), currency })),
          eventPerformance: results.performance.filter(row => row.type === 'ticket').map(row => ({ id: row.id, title: row.title, ticketsSold: Number(row.tickets), revenueMinor: String(row.amount), currency, href: '/organizer/dashboard/events/' + row.id })),
          campaignPerformance: results.performance.filter(row => row.type === 'donation').map(row => ({ id: row.id, title: row.title, collected: String(row.amount), goal: String(row.goal ?? 0n), currency, href: '/organizer/dashboard/campaigns/' + row.id })), updatedAt: new Date().toISOString() });
      }

      const result = await prisma.$transaction(async tx => {
        const totals = await tx.$queryRaw<{ total: bigint; gross: Prisma.Decimal }[]>(Prisma.sql`${source} SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN paid THEN amount ELSE 0 END), 0) AS gross FROM filtered`);
        const rows = await tx.$queryRaw<{ id: string; reference: string; type: string; title: string; person: string; date: Date; amount: bigint; currency: string; status: string; subtitle: string }[]>(Prisma.sql`${source} SELECT * FROM filtered ORDER BY ${ordering} LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`);
        return { totals: totals[0], rows };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 15000 });
      const gross = BigInt(String(result.totals.gross));
      const fee = (gross * 5n + 50n) / 100n;
      return jsonResponse({ success: true, summary: { currency: allCurrencies ? null : currency, gross: allCurrencies ? null : String(gross), commission: allCurrencies ? null : String(fee), net: allCurrencies ? null : String(gross - fee), transactionCount: Number(result.totals.total) },
        transactions: result.rows.map(row => ({ id: row.id, reference: row.reference, type: row.type, title: row.title, person: row.person, amount: String(row.amount), currency: row.currency, status: row.status, subtitle: row.subtitle, date: row.date.toISOString() })),
        pagination: { page, pageSize, total: Number(result.totals.total) }, updatedAt: new Date().toISOString() });
    }


    /* ----------------------------------------
       3. CONDITIONS DES VENTES

       Une vente est comptabilisée ici
       uniquement si :
       - La commande est PAID
       - paidAt est renseigné
       - La ligne appartient à un événement
         de l'organisateur authentifié
       - La devise correspond au filtre

       Les commandes en attente ne sont
       jamais comptabilisées.
    ---------------------------------------- */

    const currentSalesWhere = {
      event: {
        organizationId: {
          in: organizationIds,
        },
      },

      currency,

      order: {
        status: "PAID" as const,

        currency,

        paidAt: {
          gte: range.start,
          lt: range.end,
        },
      },
    };

    const previousSalesWhere = {
      event: {
        organizationId: {
          in: organizationIds,
        },
      },

      currency,

      order: {
        status: "PAID" as const,

        currency,

        paidAt: {
          gte: range.previousStart,
          lt: range.previousEnd,
        },
      },
    };

    /* ----------------------------------------
       4. CONDITIONS DES DONS

       Les dons doivent être CONFIRMED.
       Les dons en attente sont exclus.
    ---------------------------------------- */

    const currentDonationsWhere = {
      campaign: {
        organizationId: {
          in: organizationIds,
        },
      },

      status: "CONFIRMED" as const,
      currency,

      confirmedAt: {
        gte: range.start,
        lt: range.end,
      },
    };

    /* ----------------------------------------
       5. AGRÉGATIONS ET LISTES
    ---------------------------------------- */

    const [
      currentSales,
      previousSales,
      currentDonations,
      activeEvents,
      activeCampaigns,
      events,
      recentOrderLines,
      recentDonations,
    ] = await Promise.all([
      prisma.orderLine.aggregate({
        where: currentSalesWhere,
        _sum: {
          quantity: true,
          subtotal: true,
        },
      }),

      prisma.orderLine.aggregate({
        where: previousSalesWhere,
        _sum: {
          quantity: true,
          subtotal: true,
        },
      }),

      prisma.donation.aggregate({
        where: currentDonationsWhere,
        _sum: {
          amount: true,
        },
        _count: {
          id: true,
        },
      }),

      prisma.event.count({
        where: {
          organizationId: {
            in: organizationIds,
          },
          status: "PUBLISHED",
        },
      }),

      prisma.campaign.count({
        where: {
          organizationId: {
            in: organizationIds,
          },
          status: "PUBLISHED",
        },
      }),

      prisma.event.findMany({
        where: {
          organizationId: {
            in: organizationIds,
          },
          status: "PUBLISHED",
        },
        orderBy: {
          publishedAt: "desc",
        },
        take: 5,
        select: {
          id: true,
          title: true,
          category: true,
          capacity: true,
          status: true,
          currency: true,

          venue: {
            select: {
              city: true,
              name: true,
            },
          },

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

          images: {
            orderBy: {
              position: "asc",
            },
            take: 1,
            select: {
              storageKey: true,
            },
          },
        },
      }),

      prisma.orderLine.findMany({
        where: currentSalesWhere,
        orderBy: {
          order: {
            paidAt: "desc",
          },
        },
        take: 8,
        select: {
          id: true,
          orderId: true,
          eventTitle: true,
          quantity: true,
          subtotal: true,
          currency: true,

          order: {
            select: {
              reference: true,
              paidAt: true,
              status: true,
            },
          },
        },
      }),

      prisma.donation.findMany({
        where: currentDonationsWhere,
        orderBy: {
          confirmedAt: "desc",
        },
        take: 8,
        select: {
          id: true,
          reference: true,
          amount: true,
          currency: true,
          confirmedAt: true,
          status: true,

          campaign: {
            select: {
              title: true,
            },
          },
        },
      }),
    ]);

    /* ----------------------------------------
       6. GRAPHIQUES

       Agrégations effectuées par
       PostgreSQL, et non dans le navigateur.

       Les paramètres sont transmis par
       Prisma sous forme paramétrée.

       Le filtre reste limité aux
       organisations de l'utilisateur.
    ---------------------------------------- */

    const bucketFormat =
      range.granularity === "month"
        ? "YYYY-MM"
        : "YYYY-MM-DD";

    const [
      salesBuckets,
      salesDistribution,
      eventSales,
    ] = await Promise.all([
      prisma.$queryRaw<SalesBucket[]>`
        SELECT
          to_char(
            o."paidAt" AT TIME ZONE 'UTC',
            ${bucketFormat}
          ) AS bucket,

          COALESCE(
            SUM(ol."quantity"),
            0
          )::bigint AS quantity

        FROM "OrderLine" ol

        INNER JOIN "Order" o
          ON o."id" = ol."orderId"

        INNER JOIN "Event" e
          ON e."id" = ol."eventId"

        INNER JOIN "Organization" org
          ON org."id" = e."organizationId"

        WHERE
          org."ownerId" = ${organizer.userId}::uuid
          AND org."isActive" = TRUE
          AND o."status" = 'PAID'
          AND o."paidAt" >= ${range.start}
          AND o."paidAt" < ${range.end}
          AND o."currency" = ${currency}
          AND ol."currency" = ${currency}

        GROUP BY 1
        ORDER BY 1 ASC
      `,

      prisma.$queryRaw<DistributionRow[]>`
        SELECT
          e."category" AS category,

          COALESCE(
            SUM(ol."quantity"),
            0
          )::bigint AS quantity

        FROM "OrderLine" ol

        INNER JOIN "Order" o
          ON o."id" = ol."orderId"

        INNER JOIN "Event" e
          ON e."id" = ol."eventId"

        INNER JOIN "Organization" org
          ON org."id" = e."organizationId"

        WHERE
          org."ownerId" = ${organizer.userId}::uuid
          AND org."isActive" = TRUE
          AND o."status" = 'PAID'
          AND o."paidAt" >= ${range.start}
          AND o."paidAt" < ${range.end}
          AND o."currency" = ${currency}
          AND ol."currency" = ${currency}

        GROUP BY e."category"
        ORDER BY quantity DESC
      `,

      prisma.$queryRaw<EventSalesRow[]>`
        SELECT
          e."id" AS "eventId",

          COALESCE(
            SUM(ol."quantity"),
            0
          )::bigint AS quantity

        FROM "OrderLine" ol

        INNER JOIN "Order" o
          ON o."id" = ol."orderId"

        INNER JOIN "Event" e
          ON e."id" = ol."eventId"

        INNER JOIN "Organization" org
          ON org."id" = e."organizationId"

        WHERE
          org."ownerId" = ${organizer.userId}::uuid
          AND org."isActive" = TRUE
          AND o."status" = 'PAID'

        GROUP BY e."id"
      `,
    ]);

    /* ----------------------------------------
       7. CALCUL DES INDICATEURS
    ---------------------------------------- */

    const ticketsSold = safeCount(
      currentSales._sum.quantity
    );

    const previousTicketsSold = safeCount(
      previousSales._sum.quantity
    );

    const ticketRevenue =
      currentSales._sum.subtotal ?? BigInt(0);

    const previousTicketRevenue =
      previousSales._sum.subtotal ?? BigInt(0);

    const donationRevenue =
      currentDonations._sum.amount ??
      BigInt(0);

    const donationCount =
      currentDonations._count.id;

    const salesChange = percentageChange(
      ticketsSold,
      previousTicketsSold
    );

    // Les pourcentages financiers sont
    // calculés uniquement sur les sommes
    // exactes, sans convertir les montants
    // élevés en nombres flottants.

    const revenueChange =
      previousTicketRevenue === BigInt(0)
        ? null
        : Number(
            (
              (ticketRevenue -
                previousTicketRevenue) *
              BigInt(10000)
            ) / previousTicketRevenue
          ) / 100;

    /* ----------------------------------------
       8. GRAPHIQUE DES VENTES
    ---------------------------------------- */

    const salesChart = buildSalesChart(
      salesBuckets,
      range,
      language
    );

    /* ----------------------------------------
       9. RÉPARTITION DES VENTES
    ---------------------------------------- */

    const distribution =
      salesDistribution.map((row) => ({
        category: row.category,
        value: bigintToSafeNumber(
          row.quantity
        ),
      }));

    /* ----------------------------------------
       10. ÉVÉNEMENTS EN COURS DE VENTE

       Les billets affichés par événement
       correspondent aux commandes payées,
       toutes périodes confondues.

       Les URLs des fichiers privés ne sont
       pas exposées ici.

       Une URL publique validée devra être
       fournie par le service d'images.
    ---------------------------------------- */

    const eventSalesMap = new Map(
      eventSales.map((row) => [
        row.eventId,
        bigintToSafeNumber(row.quantity),
      ])
    );

    const eventList = events.map((event) => ({
      id: event.id,
      title: event.title,
      category: event.category,

      imageUrl: (() => {
        const key = event.images[0]?.storageKey;
        const id = key?.match(/(?:^|\/)([0-9a-f-]{36})(?:\.(?:jpg|png|webp))?$/i)?.[1];
        return id ? `/api/organizer/events/images?id=${encodeURIComponent(id)}` : null;
      })(),

      city: event.venue?.city ?? null,
      venue: event.venue?.name ?? null,

      startsAt:
        event.schedules[0]?.startsAt.toISOString() ??
        null,

      endsAt:
        event.schedules[0]?.endsAt?.toISOString() ??
        null,

      ticketsSold:
        eventSalesMap.get(event.id) ?? 0,

      capacity: event.capacity,
      currency: event.currency,

      status: event.status,

      href: "/organizer/dashboard/events",
    }));

    /* ----------------------------------------
       11. DERNIÈRES TRANSACTIONS

       Données minimales :
       - Type
       - Référence
       - Intitulé
       - Montant
       - Devise
       - Date
       - Statut

       Aucune adresse email d'acheteur
       ou de donateur n'est exposée.
    ---------------------------------------- */

    const ticketTransactions =
      recentOrderLines.map((line) => ({
        id: `ticket-${line.id}`,
        type: "TICKET_SALE" as const,
        reference: line.order.reference,
        title: line.eventTitle,
        quantity: line.quantity,
        amount: amountToString(
          line.subtotal
        ),
        currency: line.currency,
        date:
          line.order.paidAt?.toISOString() ??
          null,
        status: line.order.status,
      }));

    const donationTransactions =
      recentDonations.map((donation) => ({
        id: `donation-${donation.id}`,
        type: "DONATION" as const,
        reference: donation.reference,
        title: donation.campaign.title,
        quantity: 1,
        amount: amountToString(
          donation.amount
        ),
        currency: donation.currency,
        date:
          donation.confirmedAt?.toISOString() ??
          null,
        status: donation.status,
      }));

    const transactions = [
      ...ticketTransactions,
      ...donationTransactions,
    ]
      .sort((a, b) => {
        const dateA = a.date
          ? new Date(a.date).getTime()
          : 0;

        const dateB = b.date
          ? new Date(b.date).getTime()
          : 0;

        return dateB - dateA;
      })
      .slice(0, 8);

    /* ----------------------------------------
       12. RÉPONSE FINALE

       Tous les résultats appartiennent
       aux organisations authentifiées.

       Les montants sont conservés
       en unités monétaires entières.
    ---------------------------------------- */

    return jsonResponse({
      success: true,

      filters: {
        period,
        quickView,
        currency,
        locale: language,

        startDate:
          range.start.toISOString(),

        endDateExclusive:
          range.end.toISOString(),

        granularity:
          range.granularity,
      },

      updatedAt: new Date().toISOString(),

      stats: {
        ticketsSold: {
          value: ticketsSold,
          previousValue:
            previousTicketsSold,
          changePercent: salesChange,
        },

        revenue: {
          value: amountToString(
            ticketRevenue
          ),

          previousValue: amountToString(
            previousTicketRevenue
          ),

          changePercent: revenueChange,
          currency,
        },

        activeEvents: {
          value: activeEvents,
        },

        activeFundraisers: {
          value: activeCampaigns,
        },

        donations: {
          count: donationCount,
          amount: amountToString(
            donationRevenue
          ),
          currency,
        },
      },

      salesChart,

      salesDistribution: distribution,

      events: eventList,

      transactions,
    });
  } catch (error) {
    console.error(
      "[TIKEMIA DASHBOARD]",
      error instanceof Error
        ? error.message
        : "Unknown server error"
    );

    return errorResponse(
      language,
      "serverError",
      503
    );
  }
}
