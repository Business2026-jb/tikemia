import { unstable_rethrow } from "next/navigation";
import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { PrismaPg } from "@prisma/adapter-pg";

import {
  PrismaClient,
} from "@/generated/prisma/client";

/*
  TIKEMIA PAY — PAYMENT STATUS

  GET /api/public/checkout/status

  Query:
  - paymentId
  - statusToken

  Le paiement peut être effectué
  avec ou sans compte utilisateur.

  Le statusToken doit être généré
  par l'API checkout/pay.
*/

const STATUS_CONTEXT =
  "tikemia:checkout-status:v1";

const STATUS_VALIDITY_MS =
  24 * 60 * 60 * 1000;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TOKEN_PATTERN =
  /^[a-f0-9]{64}$/i;

const RESPONSE_HEADERS = {
  "Cache-Control":
    "private, no-store, no-cache, must-revalidate",

  "X-Content-Type-Options":
    "nosniff",

  Vary: "Cookie",
};

type PublicStatus =
  | "pending"
  | "processing"
  | "success"
  | "failed"
  | "cancelled"
  | "refunded";

type Locale = "fr" | "en";

const MESSAGES = {
  fr: {
    pending: "Paiement en attente",
    processing: "Validation en cours",
    success: "Paiement confirmé",
    failed: "Paiement échoué",
    cancelled: "Paiement annulé",
    refunded: "Paiement remboursé",
    unavailable: "Vérification indisponible",
  },

  en: {
    pending: "Payment pending",
    processing: "Processing payment",
    success: "Payment confirmed",
    failed: "Payment failed",
    cancelled: "Payment cancelled",
    refunded: "Payment refunded",
    unavailable: "Status unavailable",
  },
} as const;

/* ==================================================
   PRISMA
================================================== */

const prismaGlobal =
  globalThis as typeof globalThis & {
    tikemiaPrisma?: PrismaClient;
  };

function getPrisma(): PrismaClient {
  if (prismaGlobal.tikemiaPrisma) {
    return prismaGlobal.tikemiaPrisma;
  }

  const connectionString =
    process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL_NOT_CONFIGURED"
    );
  }

  const adapter = new PrismaPg({
    connectionString,
  });

  const prisma = new PrismaClient({
    adapter,
  });

  prismaGlobal.tikemiaPrisma = prisma;

  return prisma;
}

/* ==================================================
   RESPONSES
================================================== */

function json(
  data: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(data, {
    status,
    headers: RESPONSE_HEADERS,
  });
}

function error(
  code: string,
  status: number
) {
  return json(
    {
      success: false,
      code,
    },
    status
  );
}

/* ==================================================
   ACCESS TOKEN

   Une référence de paiement seule
   ne suffit pas pour accéder à son état.

   Le statusToken est calculé par
   checkout/pay côté serveur.

   Il n'est pas enregistré en base.
================================================== */

function getStatusSecret(): string {
  const secret =
    process.env.TIKEMIA_OTP_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "CHECKOUT_STATUS_SECRET_MISSING"
    );
  }

  return secret;
}

function createStatusToken(
  paymentId: string,
  paymentReference: string,
  createdAt: Date
): string {
  return createHmac(
    "sha256",
    getStatusSecret()
  )
    .update(STATUS_CONTEXT)
    .update("\0")
    .update(paymentId)
    .update("\0")
    .update(paymentReference)
    .update("\0")
    .update(createdAt.toISOString())
    .digest("hex");
}

function verifyStatusToken(
  submittedToken: string,
  paymentId: string,
  paymentReference: string,
  createdAt: Date
): boolean {
  if (!TOKEN_PATTERN.test(submittedToken)) {
    return false;
  }

  const expiresAt =
    createdAt.getTime() +
    STATUS_VALIDITY_MS;

  if (Date.now() > expiresAt) {
    return false;
  }

  const expectedToken =
    createStatusToken(
      paymentId,
      paymentReference,
      createdAt
    );

  return timingSafeEqual(
    Buffer.from(submittedToken, "hex"),
    Buffer.from(expectedToken, "hex")
  );
}

/* ==================================================
   OPTIONAL SESSION VALIDATION

   Le token de suivi suffit pour
   le paiement invité.

   Aucun identifiant client fourni
   par le navigateur n'est utilisé.
================================================== */



/* ==================================================
   PAYMENT STATUS MAPPING

   On ne considère jamais un paiement
   INITIATED ou PENDING comme payé.
================================================== */

function paymentStatus(
  status: string
): PublicStatus {
  switch (status) {
    case "FAILED":
      return "failed";

    case "CANCELLED":
      return "cancelled";

    case "REFUNDED":
    case "PARTIALLY_REFUNDED":
    case "CHARGEBACK":
      return "refunded";

    case "SUCCEEDED":
      return "processing";

    case "INITIATED":
    case "PENDING":
    default:
      return "pending";
  }
}

/* ==================================================
   GET
================================================== */

export async function GET(
  request: NextRequest
) {
  try {
    const params =
      request.nextUrl.searchParams;

    const paymentId =
      params.get("paymentId")?.trim() ?? "";

    const statusToken =
      params.get("statusToken")?.trim() ?? "";

    const locale: Locale =
      params.get("locale") === "en"
        ? "en"
        : "fr";

    if (
      !UUID_PATTERN.test(paymentId) ||
      !TOKEN_PATTERN.test(statusToken)
    ) {
      return error(
        "INVALID_REQUEST",
        400
      );
    }

    const prisma = getPrisma();

    /* ============================================
       CHARGER LE PAIEMENT

       Les références fournisseur,
       clés et données bancaires
       ne sont pas exposées.
    ============================================ */

    const payment =
      await prisma.payment.findUnique({
        where: {
          id: paymentId,
        },

        select: {
          id: true,
          reference: true,
          purpose: true,
          status: true,

          amount: true,
          currency: true,

          paidAt: true,
          createdAt: true,
          updatedAt: true,

          orderId: true,
          donationId: true,

          order: {
            select: {
              status: true,
              paidAt: true,

              lines: {
                select: {
                  quantity: true,
                },
              },

              _count: {
                select: {
                  tickets: true,
                },
              },
            },
          },

          donation: {
            select: {
              status: true,
              confirmedAt: true,
            },
          },
        },
      });

    /* ============================================
       NE PAS RÉVÉLER LES RÉFÉRENCES
       DES PAIEMENTS INCONNUS
    ============================================ */

    if (!payment) {
      return error(
        "PAYMENT_NOT_FOUND",
        404
      );
    }

    /* ============================================
       VÉRIFICATION DU DROIT DE SUIVI

       Le jeton n'est jamais retourné
       dans le résultat.
    ============================================ */

    const authorized =
      verifyStatusToken(
        statusToken,
        payment.id,
        payment.reference,
        payment.createdAt
      );

    if (!authorized) {
      return error(
        "PAYMENT_NOT_FOUND",
        404
      );
    }

    /* ============================================
       STATUT SERVEUR

       Le paiement doit être confirmé
       par la chaîne de paiement
       authentifiée de TIKEMIA Pay.

       Cette route ne vérifie pas
       directement le prestataire.
       Elle lit l'état persistant.
    ============================================ */

    let status: PublicStatus =
      paymentStatus(payment.status);

    let fulfilled = false;

    let ticketsReady = false;

    /* ============================================
       COMMANDE DE BILLETS
    ============================================ */

    if (
      payment.purpose === "TICKET_ORDER" &&
      payment.order
    ) {
      const order = payment.order;

      const requestedTickets =
        order.lines.reduce(
          (total, line) =>
            total + line.quantity,
          0
        );

      const issuedTickets =
        order._count.tickets;

      ticketsReady =
        requestedTickets > 0 &&
        issuedTickets >= requestedTickets;

      fulfilled =
        payment.status === "SUCCEEDED" &&
        payment.paidAt !== null &&
        order.status === "PAID" &&
        order.paidAt !== null &&
        ticketsReady;
    }

    /* ============================================
       DON
    ============================================ */

    if (
      payment.purpose === "DONATION" &&
      payment.donation
    ) {
      fulfilled =
        payment.status === "SUCCEEDED" &&
        payment.paidAt !== null &&
        payment.donation.status ===
          "CONFIRMED" &&
        payment.donation.confirmedAt !== null;
    }

    /* ============================================
       CONFIRMATION FINALE

       Une réponse positive du
       fournisseur ne suffit pas
       si le traitement de la commande
       n'est pas encore finalisé.
    ============================================ */

    if (
      payment.status === "SUCCEEDED" &&
      fulfilled
    ) {
      status = "success";
    }

    if (
      payment.status === "SUCCEEDED" &&
      !fulfilled
    ) {
      status = "processing";
    }

    const terminal =
      status === "success" ||
      status === "failed" ||
      status === "cancelled" ||
      status === "refunded";

    /* ============================================
       RÉPONSE POUR PAGE CHECKOUT

       Montants au format string :
       pas de perte de précision BigInt.

       Le navigateur conserve
       la devise initiale.
    ============================================ */

    return json({
      success: true,

      data: {
        paymentId: payment.id,

        type:
          payment.purpose === "DONATION"
            ? "donation"
            : "tickets",

        status,

        message:
          MESSAGES[locale][status],

        confirmed:
          status === "success",

        terminal,

        paymentStatus:
          payment.status,

        fulfillmentStatus:
          fulfilled
            ? "completed"
            : "pending",

        amountMinor:
          payment.amount.toString(),

        currency:
          payment.currency,

        ticketsReady:
          payment.purpose ===
          "TICKET_ORDER"
            ? ticketsReady
            : null,

        paidAt:
          payment.paidAt
            ?.toISOString() ?? null,

        updatedAt:
          payment.updatedAt
            .toISOString(),

        nextPollSeconds:
          terminal ? null : 3,
      },
    });

  } catch (cause) {
    unstable_rethrow(cause);
    console.error(
      "[TIKEMIA_CHECKOUT_STATUS]",
      cause instanceof Error
        ? cause.name
        : "UNKNOWN_ERROR"
    );

    return error(
      "STATUS_UNAVAILABLE",
      503
    );
  }
}