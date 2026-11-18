import { after } from "next/server";
import { runEmailWorker } from "@/lib/email/worker";
import { unstable_rethrow } from "next/navigation";

import { withFedaPayPayment } from "@/lib/payments/fedapay";
import { currencyDecimals } from "@/i18n/config";

import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";



import { Prisma } from "@/generated/prisma/client";

import {
  getPlatformPrisma,
} from "@/lib/payments/fulfillment";

import {
  verifyFedaPayTransaction,
} from "@/lib/payments/fedapay";

import {
  fulfillConfirmedPayment,
} from "@/lib/payments/fulfillment";

import type {
  PaymentMoney,
  ProviderPaymentStatus,
} from "@/lib/payments/types";

/**
 * ============================================================
 * TIKEMIA PAY — WEBHOOK FEDAPAY
 * ============================================================
 *
 * POST /api/webhooks/fedapay
 *
 * 1. Lire le corps brut.
 * 2. Vérifier la signature officielle FedaPay.
 * 3. Identifier l'événement et la transaction.
 * 4. Retrouver le paiement local.
 * 5. Vérifier la transaction auprès de FedaPay.
 * 6. Comparer le montant et la devise.
 * 7. Dédupliquer les événements.
 * 8. Enregistrer le statut réel du paiement.
 * 9. Déclencher le fulfillment si SUCCEEDED.
 * 10. Marquer l'événement comme traité.
 *
 * Le fulfillment :
 * - Finalise la commande.
 * - Génère les billets et leurs identifiants QR.
 * - Confirme les dons.
 * - Prépare une tâche EmailDelivery QUEUED.
 *
 * Les PDF et les emails seront ensuite traités
 * indépendamment par le worker.
 *
 * Le webhook ne dépend pas du navigateur client.
 * ============================================================
 */


const PROVIDER = "fedapay";

const MAX_WEBHOOK_BYTES = 256_000;
const MAX_SIGNATURE_LENGTH = 1024;
const MAX_EVENT_ID_LENGTH = 255;
const MAX_EVENT_NAME_LENGTH = 120;

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
} as const;

const SUPPORTED_EVENTS = new Set([
  "transaction.created",
  "transaction.pending",
  "transaction.approved",
  "transaction.transferred",
  "transaction.declined",
  "transaction.failed",
  "transaction.canceled",
  "transaction.cancelled",
]);

type JsonRecord = Record<string, unknown>;

type ParsedWebhook = {
  id: string;
  name: string;
  transactionId: string | null;
  payload: Prisma.InputJsonObject;
};

type PaymentSnapshot = {
  id: string;
  reference: string;
  provider: string;
  providerRef: string | null;
  status: string;
  amount: bigint;
  currency: string;
  purpose: string;
  orderId: string | null;
  donationId: string | null;
};

type WebhookResult =
  | "processed"
  | "duplicate"
  | "ignored"
  | "pending"
  | "unmatched";

class WebhookError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number
  ) {
    super(code);
    this.name = "WebhookError";
  }
}

/* ============================================================
   RÉPONSES HTTP
============================================================ */

function response(
  status: number,
  result: string
): NextResponse {
  return NextResponse.json(
    {
      received: status >= 200 && status < 300,
      result,
    },
    {
      status,
      headers: RESPONSE_HEADERS,
    }
  );
}

/* ============================================================
   VALIDATION DES DONNÉES
============================================================ */

function isRecord(
  value: unknown
): value is JsonRecord {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function readIdentifier(
  value: unknown
): string | null {
  if (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= MAX_EVENT_ID_LENGTH
  ) {
    return value.trim();
  }

  if (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
  ) {
    return String(value);
  }

  return null;
}

function readText(
  value: unknown,
  maximumLength: number
): string | null {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > maximumLength
  ) {
    return null;
  }

  return value.trim();
}

/* ============================================================
   CONFIGURATION DU SECRET
============================================================ */

/**
 * Le secret est celui du webhook FedaPay LIVE,
 * pas la clé API utilisée pour créer les paiements.
 */

function getWebhookSecret(): string {
  const secret =
    process.env.FEDAPAY_WEBHOOK_SECRET?.trim();

  if (!secret || secret.length < 16) {
    throw new WebhookError(
      "WEBHOOK_NOT_CONFIGURED",
      503
    );
  }

  return secret;
}

/* ============================================================
   LECTURE LIMITÉE DU CORPS BRUT
============================================================ */

async function readRawBody(
  request: NextRequest
): Promise<Buffer> {
  const declaredLength =
    request.headers.get("content-length");

  if (declaredLength !== null) {
    const size = Number(declaredLength);

    if (
      !Number.isSafeInteger(size) ||
      size < 0 ||
      size > MAX_WEBHOOK_BYTES
    ) {
      throw new WebhookError(
        "PAYLOAD_TOO_LARGE",
        413
      );
    }
  }

  if (!request.body) {
    throw new WebhookError(
      "EMPTY_PAYLOAD",
      400
    );
  }

  const reader = request.body.getReader();
  const chunks: Buffer[] = [];

  let total = 0;

  try {
    while (true) {
      const { done, value } =
        await reader.read();

      if (done) break;

      total += value.byteLength;

      if (total > MAX_WEBHOOK_BYTES) {
        await reader.cancel();
        throw new WebhookError(
          "PAYLOAD_TOO_LARGE",
          413
        );
      }

      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  if (total === 0) {
    throw new WebhookError(
      "EMPTY_PAYLOAD",
      400
    );
  }

  return Buffer.concat(chunks, total);
}

/* ============================================================
   SIGNATURE OFFICIELLE FEDAPAY
============================================================ */

async function authenticateWebhook(
  rawBody: Buffer,
  signature: string | null
): Promise<unknown> {
  if (
    !signature ||
    signature.length > MAX_SIGNATURE_LENGTH
  ) {
    throw new WebhookError(
      "INVALID_SIGNATURE",
      400
    );
  }

  const secret = getWebhookSecret();

  try {
    const parts = signature.split(",").map(part => part.trim());
    const timestamps = parts.filter(part => part.startsWith("t="));
    if (timestamps.length !== 1 || !/^t=[0-9]{1,12}$/.test(timestamps[0])) throw new Error("INVALID_TIMESTAMP");
    const timestamp = timestamps[0].slice(2);
    if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > 300) throw new Error("EXPIRED_SIGNATURE");
    const expected = createHmac("sha256", secret).update(timestamp + ".").update(rawBody).digest();
    const valid = parts.some(part => {
      if (!/^s=[a-fA-F0-9]{64}$/.test(part)) return false;
      return timingSafeEqual(expected, Buffer.from(part.slice(2), "hex"));
    });
    if (!valid) throw new Error("INVALID_SIGNATURE");
    return JSON.parse(rawBody.toString("utf8"));
  } catch {
    throw new WebhookError(
      "INVALID_SIGNATURE",
      400
    );
  }
}

/* ============================================================
   EXTRACTION DE L'IDENTIFIANT TRANSACTION
============================================================ */

function extractTransactionId(
  event: JsonRecord
): string | null {
  const entity =
    isRecord(event.entity)
      ? event.entity
      : null;

  const data =
    isRecord(event.data)
      ? event.data
      : null;

  const dataObject =
    data && isRecord(data.object)
      ? data.object
      : null;

  const dataTransaction =
    data && isRecord(data.transaction)
      ? data.transaction
      : null;

  const entityTransaction =
    entity && isRecord(entity.transaction)
      ? entity.transaction
      : null;

  const candidates: unknown[] = [
    entity?.id,
    entityTransaction?.id,
    dataObject?.id,
    dataTransaction?.id,
    data?.transaction_id,
    event.transaction_id,
  ];

  for (const candidate of candidates) {
    const id = readIdentifier(candidate);

    if (id) return id;
  }

  return null;
}

/* ============================================================
   PARSING DE L'ÉVÉNEMENT AUTHENTIFIÉ
============================================================ */

function parseWebhook(
  authenticatedEvent: unknown,
  rawBody: Buffer
): ParsedWebhook {
  if (!isRecord(authenticatedEvent)) {
    throw new WebhookError(
      "INVALID_EVENT",
      400
    );
  }

  const name = readText(
    authenticatedEvent.name,
    MAX_EVENT_NAME_LENGTH
  );

  if (!name) {
    throw new WebhookError(
      "INVALID_EVENT_NAME",
      400
    );
  }

  const explicitId =
    readIdentifier(authenticatedEvent.id);

  // Déduplication stable si l'événement
  // n'a pas d'identifiant officiel.
  const eventId =
    explicitId ??
    createHash("sha256")
      .update(rawBody)
      .digest("hex");

  if (eventId.length > MAX_EVENT_ID_LENGTH) {
    throw new WebhookError(
      "INVALID_EVENT_ID",
      400
    );
  }

  /*
   * Stocker le JSON réellement signé et reçu,
   * plutôt que l'objet interne du SDK.
   */
  let rawPayload: unknown;

  try {
    rawPayload = JSON.parse(
      rawBody.toString("utf8")
    );
  } catch {
    throw new WebhookError(
      "INVALID_JSON",
      400
    );
  }

  if (!isRecord(rawPayload)) {
    throw new WebhookError(
      "INVALID_EVENT_PAYLOAD",
      400
    );
  }

  return {
    id: eventId,
    name,
    transactionId:
      extractTransactionId(authenticatedEvent),
    payload:
      rawPayload as Prisma.InputJsonObject,
  };
}

/* ============================================================
   PRÉCISION DES DEVISES
============================================================ */

/**
 * Les montants sont enregistrés en unités
 * mineures dans PostgreSQL.
 *
 * Les devises utilisées par TIKEMIA
 * peuvent inclure XOF, NGN, GHS,
 * EUR, USD, ZAR, etc.
 *
 * La précision est récupérée à partir
 * des règles monétaires Intl.
 */

function getCurrencyExponent(
  currency: string
): number {
  const code = currency.toUpperCase();

  if (!/^[A-Z]{3}$/.test(code)) {
    throw new WebhookError(
      "INVALID_CURRENCY",
      422
    );
  }

  try {
    const digits =
      currencyDecimals(code);

    if (
      !Number.isInteger(digits) ||
      digits < 0 ||
      digits > 3
    ) {
      throw new Error(
        "INVALID_CURRENCY_EXPONENT"
      );
    }

    return digits;
  } catch {
    throw new WebhookError(
      "UNSUPPORTED_CURRENCY",
      422
    );
  }
}

function expectedMoney(
  payment: PaymentSnapshot
): PaymentMoney {
  if (
    payment.amount <= 0n ||
    payment.amount >
      9_223_372_036_854_775_807n
  ) {
    throw new WebhookError(
      "INVALID_PAYMENT_AMOUNT",
      422
    );
  }

  return {
    amountMinor:
      payment.amount.toString(),

    currency:
      payment.currency.toUpperCase(),

    exponent:
      getCurrencyExponent(
        payment.currency
      ),
  };
}

/* ============================================================
   RECHERCHE DU PAIEMENT LOCAL
============================================================ */

async function findLocalPayment(
  transactionId: string
): Promise<PaymentSnapshot | null> {
  const prisma = getPlatformPrisma();

  return prisma.payment.findFirst({
    where: {
      provider: PROVIDER,
      providerRef: transactionId,
    },

    select: {
      id: true,
      reference: true,
      provider: true,
      providerRef: true,
      status: true,
      amount: true,
      currency: true,
      purpose: true,
      orderId: true,
      donationId: true,
    },
  });
}

/* ============================================================
   CONTRÔLE DU LIEN DE PAIEMENT
============================================================ */

function validatePaymentLink(
  payment: PaymentSnapshot,
  transactionId: string
): void {
  if (
    payment.provider !== PROVIDER ||
    payment.providerRef !== transactionId
  ) {
    throw new WebhookError(
      "TRANSACTION_MISMATCH",
      422
    );
  }

  if (payment.purpose === "TICKET_ORDER") {
    if (
      !payment.orderId ||
      payment.donationId
    ) {
      throw new WebhookError(
        "INVALID_PAYMENT_LINK",
        422
      );
    }

    return;
  }

  if (payment.purpose === "DONATION") {
    if (
      !payment.donationId ||
      payment.orderId
    ) {
      throw new WebhookError(
        "INVALID_PAYMENT_LINK",
        422
      );
    }

    return;
  }

  throw new WebhookError(
    "INVALID_PAYMENT_PURPOSE",
    422
  );
}

/* ============================================================
   ENREGISTREMENT DU WEBHOOK
============================================================ */

/**
 * Le schéma existant comporte une contrainte
 * unique : [provider, providerEventId].
 *
 * Une répétition du même événement ne crée
 * donc pas de seconde ligne.
 *
 * Un événement non finalisé reste processed=false
 * et peut être repris.
 */

async function registerWebhookEvent(
  event: ParsedWebhook,
  paymentId: string
): Promise<boolean> {
  const prisma = getPlatformPrisma();

  const uniqueWhere = {
    provider_providerEventId: {
      provider: PROVIDER,
      providerEventId: event.id,
    },
  };

  const existing =
    await prisma.paymentWebhookEvent.findUnique({
      where: uniqueWhere,

      select: {
        paymentId: true,
        processed: true,
      },
    });

  if (existing) {
    if (
      existing.paymentId &&
      existing.paymentId !== paymentId
    ) {
      throw new WebhookError(
        "EVENT_PAYMENT_MISMATCH",
        409
      );
    }

    return existing.processed;
  }

  try {
    await prisma.paymentWebhookEvent.create({
      data: {
        provider: PROVIDER,
        providerEventId: event.id,
        eventType: event.name,
        paymentId,
        payload: event.payload,
        processed: false,
      },
    });

    return false;
  } catch (error) {
    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const duplicate =
        await prisma.paymentWebhookEvent.findUnique({
          where: uniqueWhere,

          select: {
            paymentId: true,
            processed: true,
          },
        });

      if (!duplicate) {
        throw new WebhookError(
          "WEBHOOK_REGISTRATION_CONFLICT",
          503
        );
      }

      if (
        duplicate.paymentId &&
        duplicate.paymentId !== paymentId
      ) {
        throw new WebhookError(
          "EVENT_PAYMENT_MISMATCH",
          409
        );
      }

      return duplicate.processed;
    }

    throw error;
  }
}

/* ============================================================
   MARQUER L'ÉVÉNEMENT COMME TRAITÉ
============================================================ */

async function completeWebhookEvent(
  eventId: string,
  paymentId: string
): Promise<void> {
  const prisma = getPlatformPrisma();

  await prisma.paymentWebhookEvent.updateMany({
    where: {
      provider: PROVIDER,
      providerEventId: eventId,
      paymentId,
      processed: false,
    },

    data: {
      processed: true,
      processedAt: new Date(),
    },
  });
}

/* ============================================================
   VÉRIFICATION RÉELLE AUPRÈS DE FEDAPAY
============================================================ */

/**
 * Une notification webhook ne confirme
 * jamais un paiement à elle seule.
 *
 * L'API FedaPay est interrogée pour vérifier :
 * - La transaction.
 * - Le montant.
 * - La devise.
 * - Le statut officiel.
 */

async function verifyProviderPayment(
  payment: PaymentSnapshot,
  transactionId: string
): Promise<ProviderPaymentStatus> {
  const expected =
    expectedMoney(payment);

  const verification =
    await withFedaPayPayment(payment.id, () => verifyFedaPayTransaction(
      transactionId,
      expected
    ));

  if (
    verification.source !==
      "authenticated_api" ||
    verification.providerTransactionId !==
      transactionId ||
    verification.amount.currency !==
      expected.currency ||
    verification.amount.amountMinor !==
      expected.amountMinor
  ) {
    throw new WebhookError(
      "PAYMENT_VERIFICATION_FAILED",
      422
    );
  }

  return verification.status;
}

/* ============================================================
   MISE À JOUR DU STATUT FINANCIER
============================================================ */

/**
 * La source de vérité est la vérification
 * API authentifiée de FedaPay.
 *
 * Une notification tardive n'écrase jamais
 * un paiement déjà SUCCEEDED.
 *
 * Un paiement FAILED ou CANCELLED peut
 * être corrigé en SUCCEEDED si l'API
 * officielle confirme ensuite son succès.
 */

async function persistPaymentStatus(
  payment: PaymentSnapshot,
  providerStatus: ProviderPaymentStatus
): Promise<void> {
  const prisma = getPlatformPrisma();

  const identity = {
    id: payment.id,
    provider: PROVIDER,
    providerRef: payment.providerRef,
  };

  if (providerStatus === "successful") {
    await prisma.payment.updateMany({
      where: {
        ...identity,
        status: {
          in: ["INITIATED", "PENDING", "FAILED", "CANCELLED"],
        },
      },

      data: {
        status: "SUCCEEDED",
        paidAt: new Date(),
      },
    });

    return;
  }

  if (providerStatus === "failed") {
    await prisma.payment.updateMany({
      where: {
        ...identity,
        status: {
          in: [
            "INITIATED",
            "PENDING",
          ],
        },
      },

      data: {
        status: "FAILED",
      },
    });

    return;
  }

  if (providerStatus === "cancelled") {
    await prisma.payment.updateMany({
      where: {
        ...identity,
        status: {
          in: [
            "INITIATED",
            "PENDING",
          ],
        },
      },

      data: {
        status: "CANCELLED",
      },
    });

    return;
  }

  if (providerStatus === "pending") {
    await prisma.payment.updateMany({
      where: {
        ...identity,
        status: "INITIATED",
      },

      data: {
        status: "PENDING",
      },
    });
  }
}

/* ============================================================
   TRAITEMENT PRINCIPAL DU WEBHOOK
============================================================ */

async function processWebhook(
  event: ParsedWebhook
): Promise<WebhookResult> {
  /* --------------------------------------------------------
     ÉVÉNEMENTS RECONNUS
  -------------------------------------------------------- */

  if (!SUPPORTED_EVENTS.has(event.name)) {
    return "ignored";
  }

  if (!event.transactionId) {
    throw new WebhookError(
      "TRANSACTION_ID_MISSING",
      422
    );
  }

  /* --------------------------------------------------------
     IDENTIFIER LE PAIEMENT LOCAL
  -------------------------------------------------------- */

  const payment =
    await findLocalPayment(
      event.transactionId
    );

  if (!payment) {
    // Le providerRef peut ne pas avoir encore
    // été enregistré au moment de la notification.
    // Renvoyer 503 autorise une nouvelle tentative.
    return "unmatched";
  }

  validatePaymentLink(
    payment,
    event.transactionId
  );

  /* --------------------------------------------------------
     JOURNALISER L'ÉVÉNEMENT
  -------------------------------------------------------- */

  const alreadyProcessed =
    await registerWebhookEvent(
      event,
      payment.id
    );

  if (alreadyProcessed) {
    return "duplicate";
  }

  /* --------------------------------------------------------
     VÉRIFICATION API FEDAPAY
  -------------------------------------------------------- */

  const providerStatus =
    await verifyProviderPayment(
      payment,
      event.transactionId
    );

  /* --------------------------------------------------------
     PERSISTANCE DU STATUT
  -------------------------------------------------------- */

  await persistPaymentStatus(
    payment,
    providerStatus
  );

  /* ========================================================
     CAS : PAIEMENT EN ATTENTE OU INCONNU
  ======================================================== */

  if (
    providerStatus === "pending" ||
    providerStatus === "unknown"
  ) {
    await completeWebhookEvent(
      event.id,
      payment.id
    );

    return "pending";
  }

  /* ========================================================
     CAS : PAIEMENT ÉCHOUÉ OU ANNULÉ
  ======================================================== */

  if (
    providerStatus === "failed" ||
    providerStatus === "cancelled"
  ) {
    await completeWebhookEvent(
      event.id,
      payment.id
    );

    return "processed";
  }

  /* ========================================================
     CAS : PAIEMENT OFFICIELLEMENT RÉUSSI
  ======================================================== */

  if (providerStatus === "successful") {
    /*
     * Vérifier que PostgreSQL a bien
     * enregistré SUCCEEDED et paidAt.
     */

    const current =
      await getPlatformPrisma()
        .payment.findUnique({
          where: {
            id: payment.id,
          },

          select: {
            status: true,
            paidAt: true,
          },
        });

    if (
      !current ||
      current.status !== "SUCCEEDED" ||
      !current.paidAt
    ) {
      throw new WebhookError(
        "PAYMENT_STATE_CONFLICT",
        503
      );
    }

    /*
     * =====================================================
     * FINALISATION ATOMIQUE TIKEMIA
     * =====================================================
     *
     * fulfillConfirmedPayment :
     *
     * 1. Verrouille le paiement.
     * 2. Verrouille la commande ou le don.
     * 3. Vérifie montants, frais, réservations.
     * 4. Crée les billets et QR individuels.
     * 5. Passe la commande à PAID,
     *    ou confirme le don.
     * 6. Crée la tâche EmailDelivery QUEUED.
     *
     * Une erreur doit remonter.
     * Ainsi l'événement reste non traité.
     */

    const fulfillment =
      await fulfillConfirmedPayment(
        payment.id
      );

    if (!fulfillment.success) {
      throw new WebhookError(
        "FULFILLMENT_FAILED",
        503
      );
    }

    /*
     * On confirme le traitement du webhook
     * seulement après le fulfillment.
     *
     * Cela ne signifie pas que l'email
     * a déjà été livré.
     */

    dispatchQueuedEmails();
    await completeWebhookEvent(
      event.id,
      payment.id
    );

    return "processed";
  }

  return "pending";
}

/* ============================================================
   POST /api/webhooks/fedapay
============================================================ */

export async function POST(
  request: NextRequest
): Promise<NextResponse> {
  try {
    /* ------------------------------------------------------
       TYPE DE CONTENU
    ------------------------------------------------------ */

    const contentType =
      request.headers.get("content-type") ?? "";

    if (
      !contentType
        .toLowerCase()
        .startsWith("application/json")
    ) {
      return response(
        415,
        "unsupported_content_type"
      );
    }

    /* ------------------------------------------------------
       CORPS BRUT
    ------------------------------------------------------ */

    const rawBody =
      await readRawBody(request);

    /* ------------------------------------------------------
       SIGNATURE OFFICIELLE
    ------------------------------------------------------ */

    const signature =
      request.headers.get(
        "x-fedapay-signature"
      );

    const authenticatedEvent =
      await authenticateWebhook(
        rawBody,
        signature
      );

    /* ------------------------------------------------------
       ANALYSE DE L'ÉVÉNEMENT
    ------------------------------------------------------ */

    const event =
      parseWebhook(
        authenticatedEvent,
        rawBody
      );

    /* ------------------------------------------------------
       TRAITEMENT
    ------------------------------------------------------ */

    const result =
      await processWebhook(event);

    if (result === "unmatched") {
      return response(
        503,
        "reconciliation_pending"
      );
    }

    return response(
      200,
      result
    );
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof WebhookError) {
      if (error.statusCode >= 500) {
        console.error(
          "[TIKEMIA_FEDAPAY_WEBHOOK]",
          error.code
        );
      }

      return response(
        error.statusCode,
        error.code
      );
    }

    /*
     * Ne jamais enregistrer :
     * - Le secret du webhook.
     * - La clé API.
     * - Le corps complet reçu.
     * - Les informations bancaires.
     * - Les données personnelles.
     */

    console.error(
      "[TIKEMIA_FEDAPAY_WEBHOOK]",
      error instanceof Error
        ? error.name
        : "UNKNOWN_ERROR"
    );

    return response(
      503,
      "temporarily_unavailable"
    );
  }
}

/* ============================================================
   MÉTHODES NON AUTORISÉES
============================================================ */

function methodNotAllowed(): NextResponse {
  return new NextResponse(null, {
    status: 405,

    headers: {
      ...RESPONSE_HEADERS,
      Allow: "POST",
    },
  });
}

export async function GET(): Promise<NextResponse> {
  return methodNotAllowed();
}

export async function PUT(): Promise<NextResponse> {
  return methodNotAllowed();
}

export async function PATCH(): Promise<NextResponse> {
  return methodNotAllowed();
}

export async function DELETE(): Promise<NextResponse> {
  return methodNotAllowed();
}

function dispatchQueuedEmails() {
  after(async () => {
    try { await runEmailWorker({ batchSize: 3 }); }
    catch (error) { console.error("[TIKEMIA_EMAIL_DISPATCH]", error instanceof Error ? error.name : "UNKNOWN_ERROR"); }
  });
}
