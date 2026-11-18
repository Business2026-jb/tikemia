import { after } from "next/server";
import type { PaymentNextAction } from "@/lib/payments/types";
import { runEmailWorker } from "@/lib/email/worker";
import { PDFDocument } from "pdf-lib";
import { generateOrderTicketPdfs, loadStoredEventImage } from "@/lib/tickets/pdf";
import { currencyDecimals } from "@/i18n/config";
import { getProviderConnector } from "@/lib/payments/methods";
import { fulfillConfirmedPayment } from "@/lib/payments/fulfillment";

import "server-only";

import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { unstable_rethrow } from "next/navigation";

import { getPlatformPrisma } from "@/lib/payments/fulfillment";

/**
 * ============================================================
 * TIKEMIA PAY — PAYMENT & DELIVERY STATUS
 * ============================================================
 *
 * GET /api/checkout/payment-status
 *
 * Paramètres obligatoires :
 *   paymentId
 *   statusToken
 *
 * Paramètre facultatif :
 *   locale=fr|en
 *
 * Ce fichier :
 * - Authentifie l'accès au statut.
 * - Lit le paiement réel dans PostgreSQL.
 * - Vérifie la finalisation de la commande.
 * - Contrôle les billets individuels.
 * - Contrôle la tâche EmailDelivery.
 * - Distingue paiement et livraison d'email.
 * - Répond en français ou en anglais.
 *
 * Aucune opération financière ici.
 * Aucun billet créé ici.
 * Aucun email envoyé ici.
 *
 * Le webhook FedaPay et le fulfillment
 * sont responsables des confirmations.
 *
 * Le cron et le worker sont responsables
 * de l'envoi des emails.
 * ============================================================
 */


/* ============================================================
   CONFIGURATION
============================================================ */

const STATUS_CONTEXT =
  "tikemia:checkout-status:v1";

const STATUS_VALIDITY_MS =
  24 * 60 * 60 * 1000;

const CLOCK_TOLERANCE_MS = 60_000;

const POLLING_SECONDS = 3;

const MAX_QUERY_LENGTH = 1024;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TOKEN_PATTERN =
  /^[a-f0-9]{64}$/i;

const ALLOWED_PARAMS = new Set([
  "paymentId",
  "statusToken",
  "locale",
  "download",
]);

const TICKET_EMAIL_TEMPLATE =
  "ticket_purchase";

const DONATION_EMAIL_TEMPLATE =
  "donation_confirmation";

const TICKET_SUBJECT_PREFIX =
  "TIKEMIA | Billets ";

const DONATION_SUBJECT_PREFIX =
  "TIKEMIA | Confirmation du don ";

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
   TYPES PUBLICS
============================================================ */

type Locale = "fr" | "en";

type PublicPaymentStatus =
  | "pending"
  | "processing"
  | "success"
  | "failed"
  | "cancelled"
  | "refunded";

type FulfillmentStatus =
  | "pending"
  | "completed";

type PaymentType =
  | "tickets"
  | "donation";

type EmailDispatchStatus =
  | "not_queued"
  | "queued"
  | "sending"
  | "accepted"
  | "failed";

type ApiErrorCode =
  | "INVALID_REQUEST"
  | "PAYMENT_NOT_FOUND"
  | "STATUS_UNAVAILABLE";

type PaymentStatusData = {
  paymentId: string;
  type: PaymentType;

  /**
   * Compatibilité avec la page checkout.
   *
   * success signifie que le paiement
   * et la finalisation sont confirmés.
   *
   * Cela ne signifie pas que l'email
   * est arrivé chez le client.
   */
  status: PublicPaymentStatus;
  message: string;
  confirmed: boolean;
  terminal: boolean;

  paymentStatus: string;
  paymentConfirmed: boolean;

  fulfillmentStatus: FulfillmentStatus;

  amountMinor: string;
  currency: string;

  ticketsReady: boolean | null;
  ticketCount: number | null;
  issuedTicketCount: number | null;

  /**
   * Statut de l'envoi chez TIKEMIA.
   *
   * accepted = fournisseur ayant accepté
   * la demande, pas livraison prouvée.
   */
  emailStatus: EmailDispatchStatus;
  emailMessage: string;

  emailQueued: boolean;
  emailAccepted: boolean;
  emailDelivered: boolean | null;

  /**
   * Un PDF peut être généré par le worker
   * sans être conservé dans le stockage.
   *
   * On ne considère "stored" que les billets
   * disposant réellement d'une clé PDF.
   */
  pdfStatus:
    | "not_applicable"
    | "pending"
    | "stored"
    | "prepared_for_email"
    | "unknown";

  paidAt: string | null;
  updatedAt: string;
  nextPollSeconds: number | null;
  nextAction?: PaymentNextAction;
};

/* ============================================================
   TRADUCTIONS FRANÇAIS / ANGLAIS
============================================================ */

const MESSAGES: Record<
  Locale,
  Record<PublicPaymentStatus, string>
> = {
  fr: {
    pending:
      "Paiement en attente de confirmation.",

    processing:
      "Paiement confirmé. Préparation de votre commande en cours.",

    success:
      "Votre paiement est confirmé avec succès.",

    failed:
      "Le paiement a échoué.",

    cancelled:
      "Le paiement a été annulé.",

    refunded:
      "Le paiement a été remboursé.",
  },

  en: {
    pending:
      "Waiting for payment confirmation.",

    processing:
      "Payment confirmed. Your order is being prepared.",

    success:
      "Your payment has been confirmed successfully.",

    failed:
      "Payment failed.",

    cancelled:
      "Payment was cancelled.",

    refunded:
      "Payment was refunded.",
  },
};

const EMAIL_MESSAGES: Record<
  Locale,
  Record<EmailDispatchStatus, string>
> = {
  fr: {
    not_queued:
      "L'envoi de votre email n'est pas encore programmé.",

    queued:
      "Votre confirmation est en attente d'envoi.",

    sending:
      "Votre email est en cours de préparation et d'envoi.",

    accepted:
      "Votre email a été accepté par notre service d'envoi. Vérifiez votre boîte de réception et vos courriers indésirables.",

    failed:
      "L'envoi de votre email a rencontré une difficulté. Une nouvelle tentative peut être effectuée.",
  },

  en: {
    not_queued:
      "Your confirmation email has not been queued yet.",

    queued:
      "Your confirmation email is waiting to be sent.",

    sending:
      "Your email is being prepared and sent.",

    accepted:
      "Your email has been accepted by our email provider. Check your inbox and spam folder.",

    failed:
      "There was a problem sending your email. Another attempt may be made.",
  },
};

/* ============================================================
   RÉPONSES API
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
   VALIDATION DES PARAMÈTRES
============================================================ */

function validParameters(
  params: URLSearchParams
): boolean {
  for (const key of params.keys()) {
    if (!ALLOWED_PARAMS.has(key)) {
      return false;
    }

    if (params.getAll(key).length !== 1) {
      return false;
    }
  }

  return true;
}

function getLocale(
  value: string | null
): Locale {
  return value === "en" ? "en" : "fr";
}

/* ============================================================
   SECRET DU STATUT
============================================================ */

/**
 * IMPORTANT :
 *
 * Cette fonction doit rester compatible
 * avec le token créé par checkout/pay.
 *
 * Ne pas changer le contexte ou l'ordre
 * des paramètres sans modifier également
 * le générateur du token.
 *
 * Variable serveur :
 * TIKEMIA_OTP_SECRET
 */

function getStatusSecret(): string {
  const secret =
    process.env.TIKEMIA_OTP_SECRET;

  if (
    !secret ||
    Buffer.byteLength(secret, "utf8") < 32
  ) {
    throw new Error(
      "CHECKOUT_STATUS_SECRET_MISSING"
    );
  }

  return secret;
}

/* ============================================================
   SIGNATURE HMAC DU TOKEN
============================================================ */

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

/* ============================================================
   VÉRIFICATION DU TOKEN
============================================================ */

function verifyStatusToken(
  suppliedToken: string,
  paymentId: string,
  paymentReference: string,
  createdAt: Date
): boolean {
  if (
    !TOKEN_PATTERN.test(suppliedToken)
  ) {
    return false;
  }

  const createdTime =
    createdAt.getTime();

  if (
    !Number.isFinite(createdTime) ||
    createdTime >
      Date.now() + CLOCK_TOLERANCE_MS
  ) {
    return false;
  }

  if (
    Date.now() >
    createdTime + STATUS_VALIDITY_MS
  ) {
    return false;
  }

  const expectedToken =
    createStatusToken(
      paymentId,
      paymentReference,
      createdAt
    );

  const suppliedBuffer =
    Buffer.from(suppliedToken, "hex");

  const expectedBuffer =
    Buffer.from(expectedToken, "hex");

  return (
    suppliedBuffer.length ===
      expectedBuffer.length &&
    timingSafeEqual(
      suppliedBuffer,
      expectedBuffer
    )
  );
}

/* ============================================================
   CONVERSION DES STATUTS DE PAIEMENT
============================================================ */

function mapPaymentStatus(
  status: string
): PublicPaymentStatus {
  switch (status) {
    case "SUCCEEDED":
      return "processing";

    case "FAILED":
      return "failed";

    case "CANCELLED":
      return "cancelled";

    case "REFUNDED":
    case "PARTIALLY_REFUNDED":
    case "CHARGEBACK":
      return "refunded";

    case "INITIATED":
    case "PENDING":
    default:
      return "pending";
  }
}

function isTerminalStatus(
  status: PublicPaymentStatus
): boolean {
  return (
    status === "success" ||
    status === "failed" ||
    status === "cancelled" ||
    status === "refunded"
  );
}

/* ============================================================
   EMAIL DELIVERY — CONVERSION DES STATUTS
============================================================ */

/**
 * Les valeurs de EmailDelivery correspondent
 * au système fulfillment + worker :
 *
 * QUEUED
 * SENDING
 * SENT
 * FAILED
 *
 * SENT signifie ici que Resend a accepté
 * la demande d'envoi.
 *
 * Ne pas annoncer "livré" tant qu'un webhook
 * de livraison n'a pas confirmé la réception.
 */

function mapEmailStatus(
  value: string | null | undefined
): EmailDispatchStatus {
  switch (value) {
    case "QUEUED":
      return "queued";

    case "SENDING":
      return "sending";

    case "SENT":
      return "accepted";

    case "FAILED":
      return "failed";

    default:
      return "not_queued";
  }
}

/* ============================================================
   GET /api/checkout/payment-status
============================================================ */

export async function GET(
  request: NextRequest
): Promise<NextResponse> {
  try {
    /* ======================================================
       PARAMÈTRES
    ====================================================== */

    const url = request.nextUrl;

    if (
      url.search.length >
      MAX_QUERY_LENGTH
    ) {
      return errorResponse(
        "INVALID_REQUEST",
        400
      );
    }

    const params =
      url.searchParams;

    if (!validParameters(params)) {
      return errorResponse(
        "INVALID_REQUEST",
        400
      );
    }

    const paymentId =
      params.get("paymentId")?.trim() ?? "";

    const statusToken =
      params.get("statusToken")?.trim() ?? "";

    const locale =
      getLocale(params.get("locale"));

    if (
      !UUID_PATTERN.test(paymentId) ||
      !TOKEN_PATTERN.test(statusToken)
    ) {
      return errorResponse(
        "INVALID_REQUEST",
        400
      );
    }

    /* ======================================================
       POSTGRESQL
    ====================================================== */

    const prisma =
      getPlatformPrisma();

    const payment =
      await prisma.payment.findUnique({
        where: {
          id: paymentId,
        },

        select: {
          id: true,
          reference: true,
          provider: true,
          providerRef: true,
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
              reference: true,
              status: true,
              paidAt: true,

              lines: {
                select: {
                  id: true,
                  quantity: true,
                },
              },

              tickets: {
                select: {
                  id: true,
                  orderLineId: true,
                  qrTokenHash: true,
                  pdfStorageKey: true,
                },
              },
            },
          },

          donation: {
            select: {
              reference: true,
              status: true,
              confirmedAt: true,
            },
          },
        },
      });

    /* ======================================================
       PAIEMENT INTROUVABLE
    ====================================================== */

    if (!payment) {
      return errorResponse(
        "PAYMENT_NOT_FOUND",
        404
      );
    }

    /* ======================================================
       AUTORISATION HMAC
    ====================================================== */

    if (
      !verifyStatusToken(
        statusToken,
        payment.id,
        payment.reference,
        payment.createdAt
      )
    ) {
      return errorResponse(
        "PAYMENT_NOT_FOUND",
        404
      );
    }

    /* ======================================================
       TYPE DE PAIEMENT
    ====================================================== */

    if (
      payment.purpose !== "TICKET_ORDER" &&
      payment.purpose !== "DONATION"
    ) {
      return errorResponse(
        "STATUS_UNAVAILABLE",
        503
      );
    }

    const executor = getProviderConnector(payment.provider)?.checkout;
    if (executor && payment.providerRef &&
        (payment.status === "INITIATED" || payment.status === "PENDING") &&
        Date.now() - payment.updatedAt.getTime() >= 5000) {
      const claimed = await prisma.payment.updateMany({ where: { id: payment.id, status: payment.status, updatedAt: payment.updatedAt }, data: { updatedAt: new Date() } });
      if (claimed.count === 1) {
        try {
          const expected = { currency: payment.currency, amountMinor: payment.amount.toString(), exponent: currencyDecimals(payment.currency) };
          const verified = await executor.verify(payment.id, payment.providerRef!, expected);
          if (verified.source === "authenticated_api" && verified.providerTransactionId === payment.providerRef &&
              verified.amount.currency === expected.currency && verified.amount.amountMinor === expected.amountMinor && verified.status === "successful") {
            await prisma.payment.updateMany({ where: { id: payment.id, status: { in: ["INITIATED", "PENDING"] } }, data: { status: "SUCCEEDED", paidAt: new Date() } });
            await fulfillConfirmedPayment(payment.id);
            dispatchQueuedEmails();
            return GET(request);
          } else if (verified.source === "authenticated_api" && verified.providerTransactionId === payment.providerRef &&
              verified.amount.currency === expected.currency && verified.amount.amountMinor === expected.amountMinor &&
              (verified.status === "failed" || verified.status === "cancelled")) {
            await prisma.payment.updateMany({ where: { id: payment.id, status: { in: ["INITIATED", "PENDING"] } }, data: { status: verified.status === "failed" ? "FAILED" : "CANCELLED" } });
            return GET(request);
          }
        } catch (error) { unstable_rethrow(error); console.warn("[TIKEMIA_PAYMENT_RECONCILIATION]", error instanceof Error ? error.name : "UNKNOWN_ERROR"); }
      }
    }
    if (payment.status === "SUCCEEDED" &&
        ((payment.order && payment.order.status !== "PAID") || (payment.donation && payment.donation.status !== "CONFIRMED"))) {
      const result = await fulfillConfirmedPayment(payment.id);
      if (result.success) { dispatchQueuedEmails(); return GET(request); }
    }

    const type: PaymentType =
      payment.purpose === "DONATION"
        ? "donation"
        : "tickets";

    /* ======================================================
       STATUT FINANCIER
    ====================================================== */

    const paymentConfirmed =
      payment.status === "SUCCEEDED" &&
      payment.paidAt !== null;

    let status =
      mapPaymentStatus(payment.status);

    let fulfilled = false;

    let ticketsReady = false;

    let ticketCount: number | null = null;

    let issuedTicketCount: number | null =
      null;

    let pdfStatus:
      PaymentStatusData["pdfStatus"] =
        type === "donation"
          ? "not_applicable"
          : "pending";

    let emailSubject: string | null = null;

    let emailTemplate: string | null = null;

    /* ======================================================
       COMMANDE DE BILLETS
    ====================================================== */

    if (
      payment.purpose === "TICKET_ORDER" &&
      payment.order
    ) {
      const order =
        payment.order;

      const expectedTickets =
        order.lines.reduce(
          (total, line) =>
            total + line.quantity,
          0
        );

      const issuedTickets =
        order.tickets.length;

      ticketCount =
        expectedTickets;

      issuedTicketCount =
        issuedTickets;

      /*
       * Vérifier que chaque ligne de commande
       * possède exactement le nombre de billets
       * correspondant à la quantité achetée.
       */

      const countsByLine =
        new Map<string, number>();

      let qrTokensPresent = true;

      for (const ticket of order.tickets) {
        countsByLine.set(
          ticket.orderLineId,
          (
            countsByLine.get(
              ticket.orderLineId
            ) ?? 0
          ) + 1
        );

        if (
          !ticket.qrTokenHash ||
          !/^[a-f0-9]{64}$/i.test(
            ticket.qrTokenHash
          )
        ) {
          qrTokensPresent = false;
        }
      }

      const quantitiesMatch =
        expectedTickets > 0 &&
        issuedTickets === expectedTickets &&
        order.lines.every(
          (line) =>
            countsByLine.get(line.id) ===
              line.quantity
        );

      /*
       * ticketsReady signifie :
       *
       * - Le paiement est confirmé.
       * - La commande est PAID.
       * - Tous les billets sont enregistrés.
       * - Chaque billet possède son hash QR.
       *
       * Cela ne prouve pas encore que
       * les PDF ont été envoyés.
       */

      ticketsReady =
        paymentConfirmed &&
        order.status === "PAID" &&
        order.paidAt !== null &&
        quantitiesMatch &&
        qrTokensPresent;

      fulfilled =
        ticketsReady;

      /*
       * pdfStorageKey est renseigné uniquement
       * si un PDF a été réellement enregistré
       * dans le stockage.
       *
       * Le générateur actuel renvoie un Buffer
       * au worker et n'enregistre pas forcément
       * ce PDF dans le stockage permanent.
       */

      if (ticketsReady) {
        const allPdfsStored =
          order.tickets.every(
            (ticket) =>
              typeof ticket.pdfStorageKey ===
                "string" &&
              ticket.pdfStorageKey.trim()
                .length > 0
          );

        pdfStatus =
          allPdfsStored
            ? "stored"
            : "pending";
      }

      emailSubject =
        `${TICKET_SUBJECT_PREFIX}${order.reference}`;

      emailTemplate =
        TICKET_EMAIL_TEMPLATE;
    }

    /* ======================================================
       DON / CAGNOTTE
    ====================================================== */

    if (
      payment.purpose === "DONATION" &&
      payment.donation
    ) {
      fulfilled =
        paymentConfirmed &&
        payment.donation.status ===
          "CONFIRMED" &&
        payment.donation.confirmedAt !==
          null;

      emailSubject =
        `${DONATION_SUBJECT_PREFIX}${payment.donation.reference}`;

      emailTemplate =
        DONATION_EMAIL_TEMPLATE;
    }

    /* ======================================================
       STATUT PUBLIC FINAL
    ====================================================== */

    if (payment.status === "SUCCEEDED") {
      status =
        fulfilled
          ? "success"
          : "processing";
    }

    if (params.has("download")) {
      if (params.get("download") !== "tickets") return errorResponse("INVALID_REQUEST", 400);
      if (!ticketsReady || !payment.orderId) return errorResponse("STATUS_UNAVAILABLE", 409);
      const tickets = await generateOrderTicketPdfs(payment.orderId, { locale, loadEventImage: loadStoredEventImage });
      const combined = await PDFDocument.create();
      for (const ticket of tickets) {
        const source = await PDFDocument.load(ticket.buffer);
        for (const page of await combined.copyPages(source, source.getPageIndices())) combined.addPage(page);
      }
      return new NextResponse(new Uint8Array(await combined.save()), { headers: {
        ...RESPONSE_HEADERS, "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="TIKEMIA-billets.pdf"', "Referrer-Policy": "no-referrer",
      } });
    }

    const terminal =
      isTerminalStatus(status);

    const fulfillmentStatus:
      FulfillmentStatus =
        fulfilled
          ? "completed"
          : "pending";

    /* ======================================================
       CONSULTATION DE LA TÂCHE EMAIL
    ====================================================== */

    /*
     * EmailDelivery ne contient pas encore
     * de relation directe orderId/donationId.
     *
     * On utilise donc exactement le même sujet
     * et le même template que fulfillment.ts.
     *
     * Aucune recherche approximative.
     */

    let emailStatus:
      EmailDispatchStatus =
        "not_queued";

    if (
      paymentConfirmed &&
      emailSubject &&
      emailTemplate
    ) {
      const delivery =
        await prisma.emailDelivery.findFirst({
          where: {
            template: emailTemplate,
            subject: emailSubject,
          },

          orderBy: {
            createdAt: "desc",
          },

          select: {
            status: true,
            providerMessageId: true,
            sentAt: true,
          },
        });

      emailStatus =
        mapEmailStatus(
          delivery?.status
        );

      /*
       * SENT seul ne suffit pas si les données
       * de l'acceptation sont incomplètes.
       */

      if (
        emailStatus === "accepted" &&
        (
          !delivery?.providerMessageId ||
          !delivery.sentAt
        )
      ) {
        emailStatus = "sending";
      }

      /*
       * Dans le système actuel, le worker
       * génère les PDF avant de transmettre
       * l'email à Resend.
       *
       * Une acceptation du message contenant
       * les PDF indique qu'ils ont été préparés
       * pour cette demande d'envoi.
       *
       * On ne prétend pas qu'ils ont été
       * enregistrés dans le stockage.
       */

      if (
        type === "tickets" &&
        ticketsReady &&
        pdfStatus !== "stored" &&
        emailStatus === "accepted"
      ) {
        pdfStatus =
          "prepared_for_email";
      }
    }

    /* ======================================================
       MESSAGE EMAIL
    ====================================================== */

    const emailMessage =
      EMAIL_MESSAGES[locale][emailStatus];

    /*
     * La réponse conserve le statut success
     * dès que le paiement et les billets/dons
     * sont finalisés.
     *
     * Un incident email ne transforme jamais
     * un paiement réussi en paiement échoué.
     */

    const emailQueued =
      emailStatus !== "not_queued";

    const emailAccepted =
      emailStatus === "accepted";

    /* ======================================================
       LIVRAISON EFFECTIVE
    ====================================================== */

    /*
     * Tant qu'un webhook du fournisseur d'email
     * n'enregistre pas un événement de livraison,
     * la valeur reste null.
     *
     * false signifierait une preuve d'échec
     * de livraison, ce que cette API ne possède
     * pas actuellement.
     */

    const emailDelivered: boolean | null =
      null;

    /* ======================================================
       POLLING
    ====================================================== */

    /*
     * Le suivi peut continuer pendant que
     * la tâche email est en attente.
     *
     * Après acceptation par le fournisseur,
     * on arrête le polling.
     *
     * En cas d'échec email, le client peut
     * consulter le statut de nouveau.
     */

    let nextPollSeconds: number | null;

    if (
      status === "failed" ||
      status === "cancelled" ||
      status === "refunded"
    ) {
      nextPollSeconds = null;
    } else if (
      status === "success" &&
      emailStatus === "accepted"
    ) {
      nextPollSeconds = null;
    } else {
      nextPollSeconds =
        POLLING_SECONDS;
    }

    /* ======================================================
       RÉPONSE PUBLIQUE
    ====================================================== */

    const data: PaymentStatusData = {
      paymentId:
        payment.id,

      type,

      status,

      message:
        MESSAGES[locale][status],

      confirmed:
        fulfilled,

      terminal,

      paymentStatus:
        payment.status,

      paymentConfirmed,

      fulfillmentStatus,

      amountMinor:
        payment.amount.toString(),

      currency:
        payment.currency,

      ticketsReady:
        type === "tickets"
          ? ticketsReady
          : null,

      ticketCount:
        type === "tickets"
          ? ticketCount
          : null,

      issuedTicketCount:
        type === "tickets"
          ? issuedTicketCount
          : null,

      emailStatus,

      emailMessage,

      emailQueued,

      emailAccepted,

      emailDelivered,

      pdfStatus,

      paidAt:
        payment.paidAt?.toISOString() ??
        null,

      updatedAt:
        payment.updatedAt.toISOString(),

      nextPollSeconds,
      nextAction: !terminal && !paymentConfirmed && payment.providerRef && executor?.resume
        ? await executor.resume(payment.id, payment.providerRef).catch(() => ({ type: "none" as const }))
        : undefined,
    };

    return json({
      success: true,
      data,
    });
  } catch (cause: unknown) {
    unstable_rethrow(cause);

    /*
     * Aucun email, téléphone, QR, secret
     * ou token de statut n'est journalisé.
     */

    console.error(
      "[TIKEMIA_PAYMENT_STATUS]",
      cause instanceof Error
        ? cause.name
        : "UNKNOWN_ERROR"
    );

    return errorResponse(
      "STATUS_UNAVAILABLE",
      503
    );
  }
}

/* ============================================================
   MÉTHODES HTTP NON AUTORISÉES
============================================================ */

function methodNotAllowed(): NextResponse {
  return new NextResponse(null, {
    status: 405,
    headers: {
      ...RESPONSE_HEADERS,
      Allow: "GET, HEAD",
    },
  });
}

export async function POST(): Promise<NextResponse> {
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
