import { unstable_rethrow } from "next/navigation";

import { createHash } from "node:crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { PrismaPg } from "@prisma/adapter-pg";

import {
  PrismaClient,
} from "@/generated/prisma/client";


/*
  TIKEMIA — API DASHBOARD ADMINISTRATEUR

  GET /api/admin/dashboard?period=30d

  - Français uniquement
  - Session administrateur obligatoire
  - PostgreSQL / Prisma 7
  - Statistiques réelles
  - Commissions comptabilisées
  - Montants séparés par devise
  - Transactions récentes
  - Graphiques chronologiques
  - Aucune donnée fictive
  - Aucune modification de la base

  Périodes :
  7d  : 7 jours
  30d : 30 jours
  90d : 90 jours
  12m : 12 mois
*/

/* ======================================================
   CONFIGURATION
====================================================== */

const SESSION_COOKIE =
  "tikemia_admin_session";

const ADMIN_EMAIL =
  (
    process.env.TIKEMIA_ADMIN_EMAIL ||
    "gestion@tikemia.com"
  )
    .trim()
    .toLowerCase();

const MAX_TRANSACTIONS = 8;

type Period = "7d" | "30d" | "90d" | "12m";

type Grouping = "day" | "week" | "month";

type MoneyRow = {
  currency: string;
  amountMinor: string;
};

type DashboardTransaction = {
  id: string;
  reference: string;
  type: "ticket" | "donation" | "withdrawal" | "other";
  status: string;
  amountMinor: string;
  currency: string;
  createdAt: string;
  customer: string | null;
};

type ChartRow = {
  date: string;
  currency: string;
  salesMinor: string;
  donationsMinor: string;
};

type RawChartRow = {
  date: string;
  currency: string;
  salesMinor: string;
  donationsMinor: string;
};

type PeriodConfig = {
  from: Date;
  to: Date;
  grouping: Grouping;
};

/* ======================================================
   CONNEXION PRISMA

   Réutilisation d'une seule connexion
   Prisma par instance serveur.
====================================================== */

const prismaGlobal =
  globalThis as typeof globalThis & {
    tikemiaAdminPrisma?: PrismaClient;
  };

function getPrisma(): PrismaClient {
  if (prismaGlobal.tikemiaAdminPrisma) {
    return prismaGlobal.tikemiaAdminPrisma;
  }

  const connectionString =
    process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL_MANQUANTE");
  }

  const adapter = new PrismaPg({
    connectionString,
  });

  const client = new PrismaClient({
    adapter,
  });

  prismaGlobal.tikemiaAdminPrisma = client;

  return client;
}

/* ======================================================
   RÉPONSES HTTP
====================================================== */

function json(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,

    headers: {
      "Cache-Control":
        "private, no-store, no-cache, must-revalidate",

      "X-Content-Type-Options": "nosniff",

      "X-Frame-Options": "DENY",

      Vary: "Cookie",
    },
  });
}

function forbidden(
  status: 401 | 403 = 401
) {
  return json(
    {
      success: false,

      code:
        status === 401
          ? "SESSION_INVALIDE"
          : "ACCES_INTERDIT",

      message:
        status === 401
          ? "Session administrateur invalide ou expirée."
          : "Accès administrateur interdit.",
    },
    status
  );
}

/* ======================================================
   AUTHENTIFICATION ADMINISTRATEUR

   Contrat de session :

   Cookie HttpOnly :
   tikemia_admin_session

   Valeur :
   jeton aléatoire cryptographique
   de 32 octets, encodé en hexadécimal.

   En base Session.tokenHash :
   SHA-256 du jeton.

   Seule une session non révoquée,
   non expirée, associée au compte
   administrateur autorisé, est acceptée.

   Cette fonction doit rester compatible
   avec la route de confirmation email.
====================================================== */

async function verifyAdminSession(
  request: NextRequest,
  prisma: PrismaClient
): Promise<boolean> {
  const sessionToken =
    request.cookies.get(
      SESSION_COOKIE
    )?.value;

  if (
    !sessionToken ||
    !/^[a-f0-9]{64}$/i.test(sessionToken)
  ) {
    return false;
  }

  const tokenHash = createHash("sha256")
    .update(
      Buffer.from(sessionToken, "hex")
    )
    .digest("hex");

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
            email: true,
            isActive: true,
            isBlocked: true,

            roles: {
              select: {
                role: true,
              },
            },
          },
        },
      },
    });

  if (!session) {
    return false;
  }

  if (
    session.revokedAt !== null ||
    session.expiresAt <= new Date()
  ) {
    return false;
  }

  const user = session.user;

  if (
    !user.isActive ||
    user.isBlocked ||
    user.email.trim().toLowerCase() !==
      ADMIN_EMAIL
  ) {
    return false;
  }

  return user.roles.some(
    ({ role }) =>
      role === "ADMIN" ||
      role === "SUPER_ADMIN"
  );
}

/* ======================================================
   VALIDATION PÉRIODE
====================================================== */

function getPeriod(
  value: string | null
): Period | null {
  if (!value) {
    return "30d";
  }

  if (
    value === "7d" ||
    value === "30d" ||
    value === "90d" ||
    value === "12m"
  ) {
    return value;
  }

  return null;
}

function getPeriodConfig(
  period: Period
): PeriodConfig {
  const to = new Date();

  const from = new Date(to);

  let grouping: Grouping = "day";

  if (period === "7d") {
    from.setUTCDate(
      from.getUTCDate() - 7
    );
  }

  if (period === "30d") {
    from.setUTCDate(
      from.getUTCDate() - 30
    );
  }

  if (period === "90d") {
    from.setUTCDate(
      from.getUTCDate() - 90
    );

    grouping = "week";
  }

  if (period === "12m") {
    from.setUTCMonth(
      from.getUTCMonth() - 12
    );

    grouping = "month";
  }

  return {
    from,
    to,
    grouping,
  };
}

/* ======================================================
   MONTANTS

   Toutes les sommes restent en BigInt.

   Aucune conversion entre devises.
   Aucune utilisation de flottants.
====================================================== */

function normalizeMoneyRows(
  rows: {
    currency: string;
    amount: bigint | null;
  }[]
): MoneyRow[] {
  const totals = new Map<string, bigint>();

  for (const row of rows) {
    const currency =
      row.currency.toUpperCase();

    if (!/^[A-Z]{3}$/.test(currency)) {
      continue;
    }

    totals.set(
      currency,
      (totals.get(currency) ?? 0n) +
        (row.amount ?? 0n)
    );
  }

  return Array.from(totals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, amount]) => ({
      currency,
      amountMinor: amount.toString(),
    }));
}

/* ======================================================
   GRAPHIQUE

   Agrégation directement dans
   PostgreSQL, sans charger toutes
   les commandes en mémoire.

   Date regroupée en UTC.

   Ventes :
   commandes ayant un paidAt.

   Dons :
   dons ayant un confirmedAt.

   Les statuts remboursés sont inclus
   dans les montants bruts historiques.
   Les remboursements sont calculés
   séparément.
====================================================== */

async function readChart(
  prisma: PrismaClient,
  config: PeriodConfig
): Promise<ChartRow[]> {
  const { from, to, grouping } = config;

  /*
    Le paramètre grouping n'est
    jamais fourni directement par
    le navigateur : il provient
    d'une liste fermée côté serveur.
  */

  const rows =
    await prisma.$queryRaw<RawChartRow[]>`
      SELECT
        source."date" AS "date",
        source."currency" AS "currency",

        SUM(
          source."salesAmount"
        )::text AS "salesMinor",

        SUM(
          source."donationsAmount"
        )::text AS "donationsMinor"

      FROM (
        SELECT
          TO_CHAR(
            DATE_TRUNC(
              ${grouping}::text,
              o."paidAt" AT TIME ZONE 'UTC'
            ),
            'YYYY-MM-DD'
          ) AS "date",

          o."currency" AS "currency",

          o."subtotal" AS "salesAmount",

          0::bigint AS "donationsAmount"

        FROM "Order" AS o

        WHERE
          o."paidAt" >= ${from}
          AND o."paidAt" < ${to}

          AND o."status" IN (
            'PAID',
            'PARTIALLY_REFUNDED',
            'REFUNDED'
          )

        UNION ALL

        SELECT
          TO_CHAR(
            DATE_TRUNC(
              ${grouping}::text,
              d."confirmedAt" AT TIME ZONE 'UTC'
            ),
            'YYYY-MM-DD'
          ) AS "date",

          d."currency" AS "currency",

          0::bigint AS "salesAmount",

          d."amount" AS "donationsAmount"

        FROM "Donation" AS d

        WHERE
          d."confirmedAt" >= ${from}
          AND d."confirmedAt" < ${to}

          AND d."status" IN (
            'CONFIRMED',
            'REFUNDED'
          )
      ) AS source

      GROUP BY
        source."date",
        source."currency"

      ORDER BY
        source."date" ASC,
        source."currency" ASC
    `;

  const currencies = Array.from(new Set(rows.map(row=>row.currency)));
  const indexed = new Map(rows.map(row=>[row.date+":"+row.currency,row]));
  const points: ChartRow[] = [];
  const cursor = new Date(from);
  cursor.setUTCHours(0,0,0,0);
  if (grouping === "month") cursor.setUTCDate(1);
  while (cursor < to) {
    const date = cursor.toISOString().slice(0,10);
    for (const currency of currencies) {
      const row = indexed.get(date+":"+currency);
      points.push({ date, currency, salesMinor: row?.salesMinor ?? "0", donationsMinor: row?.donationsMinor ?? "0" });
    }
    if (grouping === "month") cursor.setUTCMonth(cursor.getUTCMonth()+1);
    else cursor.setUTCDate(cursor.getUTCDate()+1);
  }
  return points;
}

/* ======================================================
   TRANSACTIONS RÉCENTES

   Source unique :
   Payment

   Le paiement reste la source
   d'information transactionnelle.

   Les achats et dons sont distingués
   par PaymentPurpose.
====================================================== */

async function readTransactions(
  prisma: PrismaClient,
  from: Date,
  to: Date
): Promise<DashboardTransaction[]> {
  const payments =
    await prisma.payment.findMany({
      where: {
        createdAt: {
          gte: from,
          lt: to,
        },
      },

      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],

      take: MAX_TRANSACTIONS,

      select: {
        id: true,
        reference: true,
        purpose: true,
        status: true,
        amount: true,
        currency: true,
        createdAt: true,
      },
    });

  return payments.map((payment) => ({
    id: payment.id,
    reference: payment.reference,

    type:
      payment.purpose === "TICKET_ORDER"
        ? "ticket"
        : payment.purpose === "DONATION"
          ? "donation"
          : "other",

    status: payment.status,

    amountMinor:
      payment.amount.toString(),

    currency: payment.currency,

    createdAt:
      payment.createdAt.toISOString(),

    /*
      Le dashboard affiche uniquement
      les références de transaction.

      Aucune information personnelle
      supplémentaire n'est nécessaire
      à cette vue.
    */
    customer: null,
  }));
}

/* ======================================================
   STATISTIQUES ET FINANCES

   Toutes les données sont calculées
   depuis les vrais modèles Prisma.

   Commissions :
   écritures SERVICE_FEE uniquement.

   L'API ne recalcule pas artificiellement
   les commissions à partir des ventes.

   Pour que les commissions apparaissent,
   la confirmation de paiement doit
   enregistrer les écritures comptables.
====================================================== */

async function buildDashboard(
  prisma: PrismaClient,
  period: Period
) {
  const config = getPeriodConfig(period);

  const { from, to } = config;

  const createdAt = {
    gte: from,
    lt: to,
  };

  const paidAt = {
    gte: from,
    lt: to,
  };

  const confirmedAt = {
    gte: from,
    lt: to,
  };

  const completedAt = {
    gte: from,
    lt: to,
  };

  const [
    organizers,
    clients,
    events,
    campaigns,
    orders,
    payments,
    withdrawals,
    tickets,

    salesGroups,
    donationGroups,
    serviceFeeGroups,
    refundGroups,

    chart,
    transactions,
    donationFeePayments,
  ] = await Promise.all([
    /* ------------------------------------------
       ORGANISATEURS

       Organisations créées sur la période.
    ------------------------------------------ */

    prisma.organization.count({
      where: {
        createdAt,
      },
    }),

    /* ------------------------------------------
       CLIENTS

       Utilisateurs ayant le rôle CLIENT.
       Comptage distinct des utilisateurs.
    ------------------------------------------ */

    prisma.user.count({
      where: {
        createdAt,

        roles: {
          some: {
            role: "CLIENT",
          },
        },
      },
    }),

    /* ------------------------------------------
       ÉVÉNEMENTS
    ------------------------------------------ */

    prisma.event.count({
      where: {
        createdAt,
      },
    }),

    /* ------------------------------------------
       CAGNOTTES
    ------------------------------------------ */

    prisma.campaign.count({
      where: {
        createdAt,
      },
    }),

    /* ------------------------------------------
       COMMANDES
    ------------------------------------------ */

    prisma.order.count({
      where: {
        createdAt,
      },
    }),

    /* ------------------------------------------
       PAIEMENTS

       Toutes les tentatives enregistrées.
       Le succès est indiqué par leur statut.
    ------------------------------------------ */

    prisma.payment.count({
      where: {
        createdAt,
      },
    }),

    /* ------------------------------------------
       RETRAITS
    ------------------------------------------ */

    prisma.payout.count({
      where: {
        requestedAt: {
          gte: from,
          lt: to,
        },
      },
    }),

    /* ------------------------------------------
       BILLETS ÉMIS
    ------------------------------------------ */

    prisma.ticket.count({
      where: {
        issuedAt: createdAt,
      },
    }),

    /* ------------------------------------------
       VENTES DE BILLETS

       Sous-total des commandes payées.
       Les frais sont comptés séparément.
    ------------------------------------------ */

    prisma.order.groupBy({
      by: ["currency"],

      where: {
        paidAt,

        status: {
          in: [
            "PAID",
            "PARTIALLY_REFUNDED",
            "REFUNDED",
          ],
        },
      },

      _sum: {
        subtotal: true,
      },
    }),

    /* ------------------------------------------
       DONS CONFIRMÉS
    ------------------------------------------ */

    prisma.donation.groupBy({
      by: ["currency"],

      where: {
        confirmedAt,

        status: {
          in: [
            "CONFIRMED",
            "REFUNDED",
          ],
        },
      },

      _sum: {
        amount: true,
      },
    }),

    /* ------------------------------------------
       COMMISSIONS TIKEMIA

       Écritures de frais réellement
       enregistrées en comptabilité.
    ------------------------------------------ */

    prisma.order.groupBy({ by: ["currency"], where: { paidAt, status: { in: ["PAID", "PARTIALLY_REFUNDED"] } }, _sum: { serviceFee: true } }),

    /* ------------------------------------------
       REMBOURSEMENTS EFFECTUÉS
    ------------------------------------------ */

    prisma.refund.groupBy({
      by: ["currency"],

      where: {
        status: "SUCCEEDED",
        completedAt,
      },

      _sum: {
        amount: true,
      },
    }),

    /* ------------------------------------------
       GRAPHIQUE
    ------------------------------------------ */

    readChart(prisma, config),

    /* ------------------------------------------
       DERNIÈRES TRANSACTIONS
    ------------------------------------------ */

    readTransactions(prisma, from, to),
    prisma.payment.findMany({ where: { status: "SUCCEEDED", paidAt, donation: { status: "CONFIRMED" } }, select: { amount: true, currency: true, donation: { select: { amount: true } } } }),
  ]);

  /* ====================================================
     NORMALISATION FINANCIÈRE
  ==================================================== */

  const sales = normalizeMoneyRows(
    salesGroups.map((row) => ({
      currency: row.currency,
      amount: row._sum.subtotal,
    }))
  );

  const donations = normalizeMoneyRows(
    donationGroups.map((row) => ({
      currency: row.currency,
      amount: row._sum.amount,
    }))
  );

  const bases = new Map<string,bigint>();
  for (const row of salesGroups) bases.set(row.currency, (bases.get(row.currency) ?? 0n) + (row._sum.subtotal ?? 0n));
  for (const row of donationGroups) bases.set(row.currency, (bases.get(row.currency) ?? 0n) + (row._sum.amount ?? 0n));
  const commissions = normalizeMoneyRows([...bases].map(([currency, amount]) => ({ currency, amount: (amount * 500n + 5000n) / 10000n })));
  const fees = new Map<string,bigint>();
  for (const row of serviceFeeGroups) fees.set(row.currency, (fees.get(row.currency) ?? 0n) + (row._sum.serviceFee ?? 0n));
  for (const row of donationFeePayments) if (row.donation && row.amount >= row.donation.amount) fees.set(row.currency, (fees.get(row.currency) ?? 0n) + row.amount - row.donation.amount);
  const serviceFees = normalizeMoneyRows([...fees].map(([currency, amount]) => ({ currency, amount })));

  const refunds = normalizeMoneyRows(
    refundGroups.map((row) => ({
      currency: row.currency,
      amount: row._sum.amount,
    }))
  );

  /* ====================================================
     FORMAT EXACT ATTENDU PAR admin/page.tsx
  ==================================================== */

  return {
    statistics: {
      organizers,
      clients,
      events,
      campaigns,
      orders,
      payments,
      withdrawals,
      tickets,
    },

    revenue: {
      sales,
      donations,
      commissions,
      serviceFees,
      refunds,
    },

    chart,
    transactions,

    generatedAt:
      new Date().toISOString(),
  };
}

/* ======================================================
   GET /api/admin/dashboard

   ORDRE OBLIGATOIRE :

   1. Vérifier la session
   2. Vérifier les autorisations
   3. Valider la période
   4. Lire PostgreSQL
   5. Retourner les données

   Aucune statistique ne peut être
   consultée sans session valide.
====================================================== */

export async function GET(
  request: NextRequest
) {
  try {
    if (!/^[a-f0-9]{64}$/i.test(request.cookies.get(SESSION_COOKIE)?.value ?? "")) return forbidden(401);
    const prisma = getPrisma();

    /* ------------------------------------------
       CONTRÔLE D'ACCÈS
    ------------------------------------------ */

    const authorized =
      await verifyAdminSession(
        request,
        prisma
      );

    if (!authorized) {
      return forbidden(401);
    }

    /* ------------------------------------------
       VALIDATION DES PARAMÈTRES
    ------------------------------------------ */

    if (request.nextUrl.searchParams.get("session") === "1") return json({ success: true });

    const period = getPeriod(
      request.nextUrl.searchParams.get(
        "period"
      )
    );

    if (!period) {
      return json(
        {
          success: false,
          code: "PERIODE_INVALIDE",
          message:
            "La période demandée est invalide.",
        },
        400
      );
    }

    /* ------------------------------------------
       CHARGEMENT DES DONNÉES RÉELLES
    ------------------------------------------ */

    const data = await buildDashboard(
      prisma,
      period
    );

    /* ------------------------------------------
       RÉPONSE
    ------------------------------------------ */

    return json({
      success: true,
      data,
    });
  } catch (error) {
    unstable_rethrow(error);
    console.error(
      "[TIKEMIA_ADMIN_DASHBOARD]",

      error instanceof Error
        ? error.name
        : "ERREUR_INCONNUE"
    );

    return json(
      {
        success: false,
        code: "DASHBOARD_INDISPONIBLE",
        message:
          "Impossible de charger les statistiques administrateur.",
      },
      503
    );
  }
}
