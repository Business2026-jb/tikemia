
import "server-only";

import {
  randomBytes,
  randomUUID,
} from "node:crypto";

import { Prisma, PrismaClient } from "@/generated/prisma/client";

import { PrismaPg } from "@prisma/adapter-pg";
const platformGlobal = globalThis as typeof globalThis & { tikemiaPlatformPrismaSchemaV2?: PrismaClient; tikemiaPlatformPrismaSignature?: string };
export function getPlatformPrisma(): PrismaClient {
 const signature = JSON.stringify(Object.entries(Prisma).filter(([key]) => key.endsWith("ScalarFieldEnum")).sort(([a], [b]) => a.localeCompare(b)));
 if (platformGlobal.tikemiaPlatformPrismaSchemaV2 && platformGlobal.tikemiaPlatformPrismaSignature === signature) return platformGlobal.tikemiaPlatformPrismaSchemaV2;
 const connectionString = process.env.DATABASE_URL;
 if (!connectionString) throw new Error("DATABASE_URL_MISSING");
 platformGlobal.tikemiaPlatformPrismaSignature = signature;
 return platformGlobal.tikemiaPlatformPrismaSchemaV2 = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

import {
  createTicketQrToken,
  hashTicketQrToken,
} from "@/lib/tickets/qr";

/**
 * ============================================================
 * TIKEMIA PAY — PAYMENT FULFILLMENT
 * ============================================================
 *
 * Fichier :
 * src/lib/payments/fulfillment.ts
 *
 * Point d'entrée :
 * fulfillConfirmedPayment(paymentId)
 *
 * Responsabilités :
 * - Vérifier les paiements SUCCEEDED.
 * - Vérifier les montants et devises.
 * - Appliquer les frais prévus.
 * - Verrouiller les ressources PostgreSQL.
 * - Finaliser les commandes de billets.
 * - Consommer les réservations.
 * - Générer un billet distinct par place.
 * - Générer un QR sécurisé par billet.
 * - Confirmer les dons.
 * - Préparer les envois automatiques.
 * - Empêcher la duplication des billets.
 * - Empêcher la duplication des tâches email.
 * - Réparer une tâche email manquante
 *   après une finalisation précédente.
 *
 * Aucun appel réseau n'est effectué
 * dans la transaction financière.
 *
 * L'envoi réel est effectué ensuite
 * par src/lib/email/worker.ts.
 *
 * Les PDF sont générés par :
 * src/lib/tickets/pdf.ts
 *
 * Le système QR est centralisé dans :
 * src/lib/tickets/qr.ts
 * ============================================================
 */

/* ============================================================
   CONSTANTES
============================================================ */

const MAX_TICKETS_PER_ORDER = 1000;

const MAX_MINOR_AMOUNT =
  9_223_372_036_854_775_807n;

const TICKET_SERVICE_FEE_BPS = 200;

const DONATION_SERVICE_FEE_BPS = 100;

const TICKET_NUMBER_PREFIX = "TKM";

const TICKET_EMAIL_TEMPLATE =
  "ticket_purchase";

const DONATION_EMAIL_TEMPLATE =
  "donation_confirmation";

const TICKET_EMAIL_SUBJECT_PREFIX =
  "TIKEMIA | Billets ";

const DONATION_EMAIL_SUBJECT_PREFIX =
  "TIKEMIA | Confirmation du don ";

const TRANSACTION_OPTIONS = {
  isolationLevel:
    Prisma.TransactionIsolationLevel.Serializable,

  maxWait: 10000,

  timeout: 30000,
} as const;

/* ============================================================
   TYPES PUBLICS
============================================================ */

export type FulfillmentType =
  | "tickets"
  | "donation";

export type FulfillmentResult = {
  success: true;

  paymentId: string;

  type: FulfillmentType;

  resourceId: string;

  alreadyFulfilled: boolean;

  ticketCount: number;

  /**
   * true :
   * une nouvelle tâche email a été créée.
   *
   * false :
   * tâche déjà présente ou destinataire
   * indisponible.
   *
   * Ne signifie jamais que l'email
   * a déjà été livré.
   */
  emailQueued: boolean;

  completedAt: string;
};

type PaymentRecord = {
  id: string;
  reference: string;
  status: string;
  purpose: string;
  provider: string;
  amount: bigint;
  currency: string;
  paidAt: Date | null;
  orderId: string | null;
  donationId: string | null;
};

type TicketLine = {
  id: string;
  eventId: string;
  ticketCategoryId: string;
  quantity: number;
  unitPrice: bigint;
  subtotal: bigint;
  currency: string;
};

type EmailJob = {
  recipient: string | null;
  subject: string;
  template:
    | typeof TICKET_EMAIL_TEMPLATE
    | typeof DONATION_EMAIL_TEMPLATE;
  userId: string | null;
  locale?: "fr" | "en";
};

type ExistingTicket = {
  id: string;
  orderLineId: string;
  eventId: string;
  ticketCategoryId: string;
};

/* ============================================================
   ERREURS
============================================================ */

export class FulfillmentError extends Error {
  constructor(
    public readonly code: string
  ) {
    super(code);
    this.name = "FulfillmentError";
  }
}

/* ============================================================
   VALIDATIONS
============================================================ */

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function validAmount(amount: bigint): boolean {
  return (
    amount > 0n &&
    amount <= MAX_MINOR_AMOUNT
  );
}

function validEmail(
  value: string | null | undefined
): value is string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > 254
  ) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value.trim()
  );
}

function normalizeLocale(
  locale: string | null | undefined
): "fr" | "en" {
  return locale === "en" ? "en" : "fr";
}

/* ============================================================
   CALCUL FINANCIER
============================================================ */

/**
 * Calcul entier avec arrondi à
 * l'unité monétaire mineure la plus proche.
 *
 * 200 bps = 2 %
 * 100 bps = 1 %
 *
 * Aucun plafond FCFA.
 * Aucun calcul financier en float.
 */

function calculateFee(
  subtotal: bigint,
  basisPoints: number
): bigint {
  if (
    !validAmount(subtotal) ||
    !Number.isSafeInteger(basisPoints) ||
    basisPoints < 0 ||
    basisPoints > 10000
  ) {
    throw new FulfillmentError(
      "INVALID_FEE_INPUT"
    );
  }

  const fee =
    (
      subtotal * BigInt(basisPoints) +
      5000n
    ) / 10000n;

  if (fee > MAX_MINOR_AMOUNT) {
    throw new FulfillmentError(
      "FEE_OUT_OF_RANGE"
    );
  }

  return fee;
}

/* ============================================================
   NUMÉRO UNIQUE DE BILLET
============================================================ */

/**
 * Chaque billet possède :
 *
 * - Un UUID unique en base.
 * - Un numéro lisible unique.
 * - Un token QR signé.
 * - Un hash SHA-256 unique.
 *
 * Le numéro est distinct de la
 * référence de commande.
 */

function createTicketNumber(): string {
  const timestamp =
    Date.now()
      .toString(36)
      .toUpperCase();

  const random =
    randomBytes(10)
      .toString("hex")
      .toUpperCase();

  return [
    TICKET_NUMBER_PREFIX,
    timestamp,
    random,
  ].join("-");
}

/* ============================================================
   COMPATIBILITÉ DES ANCIENS IMPORTS
============================================================ */

/**
 * Si des fichiers existants importent ces
 * fonctions depuis fulfillment.ts,
 * les imports continuent de fonctionner.
 *
 * La logique cryptographique reste
 * centralisée dans tickets/qr.ts.
 */

export {
  createTicketQrToken,
  hashTicketQrToken,
};

/* ============================================================
   VÉRIFICATION DE LA CONFIGURATION QR
============================================================ */

function assertQrConfiguration(): void {
  if (
    typeof process.env.TIKEMIA_TICKET_QR_SECRET !==
      "string" ||
    Buffer.byteLength(
      process.env.TIKEMIA_TICKET_QR_SECRET,
      "utf8"
    ) < 32
  ) {
    throw new FulfillmentError(
      "QR_SECRET_NOT_CONFIGURED"
    );
  }
}

/* ============================================================
   LECTURE D'UN OBJET JSON PRISMA
============================================================ */

function isJsonObject(
  value: Prisma.JsonValue | null
): value is Prisma.JsonObject {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

/* ============================================================
   SÉANCE DE L'ÉVÉNEMENT
============================================================ */

/**
 * Le checkout existant enregistre
 * la séance choisie dans :
 *
 * checkout:order:<orderId>
 *
 * On vérifie que la séance appartient
 * réellement à l'événement acheté.
 *
 * Aucune date n'est inventée.
 */

async function resolveOrderSchedule(
  tx: Prisma.TransactionClient,
  orderId: string,
  eventId: string
): Promise<string> {
  const setting =
    await tx.appSetting.findUnique({
      where: {
        key: `checkout:order:${orderId}`,
      },

      select: {
        value: true,
      },
    });

  if (
    !setting ||
    !isJsonObject(setting.value)
  ) {
    throw new FulfillmentError(
      "ORDER_SCHEDULE_MISSING"
    );
  }

  const value = setting.value;

  if (
    typeof value.scheduleId !== "string" ||
    !isUuid(value.scheduleId) ||
    value.eventId !== eventId
  ) {
    throw new FulfillmentError(
      "INVALID_ORDER_SCHEDULE"
    );
  }

  const schedule =
    await tx.eventSchedule.findFirst({
      where: {
        id: value.scheduleId,
        eventId,
      },

      select: {
        id: true,
      },
    });

  if (!schedule) {
    throw new FulfillmentError(
      "ORDER_SCHEDULE_NOT_FOUND"
    );
  }

  return schedule.id;
}

/* ============================================================
   LANGUE DE LA COMMANDE
============================================================ */

/**
 * Si le checkout a conservé locale dans
 * son contexte, on peut la réutiliser.
 *
 * Sinon français par défaut.
 *
 * Cela respecte FR par défaut
 * et EN comme deuxième langue.
 */

async function resolveOrderLocale(
  tx: Prisma.TransactionClient,
  orderId: string
): Promise<"fr" | "en"> {
  const setting =
    await tx.appSetting.findUnique({
      where: {
        key: `checkout:order:${orderId}`,
      },

      select: {
        value: true,
      },
    });

  if (
    !setting ||
    !isJsonObject(setting.value)
  ) {
    return "fr";
  }

  return normalizeLocale(
    typeof setting.value.locale === "string"
      ? setting.value.locale
      : null
  );
}

/* ============================================================
   FILE D'ATTENTE DES EMAILS
============================================================ */

/**
 * EmailDelivery est utilisé par le worker.
 *
 * Correspondance obligatoire :
 *
 * Billets :
 * template = ticket_purchase
 * subject = TIKEMIA | Billets <reference>
 *
 * Dons :
 * template = donation_confirmation
 * subject = TIKEMIA | Confirmation du don <reference>
 *
 * Le worker extrait la référence exacte
 * à partir de ces préfixes.
 *
 * Cette fonction doit être appelée pendant
 * une transaction qui verrouille déjà la
 * commande ou le don correspondant.
 *
 * Une tâche existante n'est jamais recréée,
 * même si elle est SENT, FAILED ou SENDING.
 *
 * Cela évite de renvoyer une nouvelle
 * confirmation à chaque webhook répété.
 */

async function queueEmail(
  tx: Prisma.TransactionClient,
  job: EmailJob
): Promise<boolean> {
  if (!validEmail(job.recipient)) {
    return false;
  }

  const recipient =
    job.recipient.trim().toLowerCase();

  if (
    !job.subject ||
    job.subject.length > 250 ||
    !job.subject.startsWith(
      job.template === TICKET_EMAIL_TEMPLATE
        ? TICKET_EMAIL_SUBJECT_PREFIX
        : DONATION_EMAIL_SUBJECT_PREFIX
    )
  ) {
    throw new FulfillmentError(
      "INVALID_EMAIL_JOB_SUBJECT"
    );
  }

  /*
   * Recherche par identité logique :
   * template + référence contenue
   * dans le sujet.
   *
   * Le destinataire est vérifié séparément.
   */

  const existing =
    await tx.emailDelivery.findFirst({
      where: {
        template: job.template,
        subject: job.subject,
      },

      select: {
        id: true,
        recipient: true,
      },
    });

  if (existing) {
    /*
     * Empêche d'ignorer silencieusement
     * un changement de destinataire sur
     * une tâche déjà créée.
     *
     * La correction d'une adresse email
     * doit être une opération administrative
     * contrôlée, et non une conséquence
     * d'un webhook rejoué.
     */

    if (
      existing.recipient.trim().toLowerCase() !==
      recipient
    ) {
      throw new FulfillmentError(
        "EMAIL_RECIPIENT_CONFLICT"
      );
    }

    return false;
  }

  await tx.emailDelivery.create({
    data: {
      recipient,

      template: job.template,

      subject: job.subject,

      locale: normalizeLocale(
        job.locale
      ),

      status: "QUEUED",

      userId: job.userId,
    },
  });

  return true;
}

/* ============================================================
   CRÉATION DE LA TÂCHE EMAIL — BILLETS
============================================================ */

async function queueTicketOrderEmail(
  tx: Prisma.TransactionClient,
  order: {
    id: string;
    reference: string;
    guestEmail: string | null;
    buyerId: string | null;
  }
): Promise<boolean> {
  return queueEmail(tx, {
    recipient: order.guestEmail,

    subject:
      `${TICKET_EMAIL_SUBJECT_PREFIX}${order.reference}`,

    template: TICKET_EMAIL_TEMPLATE,

    userId: order.buyerId,

    locale: await resolveOrderLocale(
      tx,
      order.id
    ),
  });
}

/* ============================================================
   CRÉATION DE LA TÂCHE EMAIL — DON
============================================================ */

async function queueDonationEmail(
  tx: Prisma.TransactionClient,
  donation: {
    reference: string;
    donorEmail: string | null;
    donorId: string | null;
  }
): Promise<boolean> {
  return queueEmail(tx, {
    recipient: donation.donorEmail,

    subject:
      `${DONATION_EMAIL_SUBJECT_PREFIX}${donation.reference}`,

    template: DONATION_EMAIL_TEMPLATE,

    userId: donation.donorId,

    locale: "fr",
  });
}

/* ============================================================
   VERROUS POSTGRESQL
============================================================ */

async function lockPayment(
  tx: Prisma.TransactionClient,
  paymentId: string
): Promise<void> {
  const rows =
    await tx.$queryRaw<
      Array<{ id: string }>
    >`
      SELECT "id"
      FROM "Payment"
      WHERE "id" = ${paymentId}::uuid
      FOR UPDATE
    `;

  if (rows.length !== 1) {
    throw new FulfillmentError(
      "PAYMENT_NOT_FOUND"
    );
  }
}

async function lockOrder(
  tx: Prisma.TransactionClient,
  orderId: string
): Promise<void> {
  const rows =
    await tx.$queryRaw<
      Array<{ id: string }>
    >`
      SELECT "id"
      FROM "Order"
      WHERE "id" = ${orderId}::uuid
      FOR UPDATE
    `;

  if (rows.length !== 1) {
    throw new FulfillmentError(
      "ORDER_NOT_FOUND"
    );
  }
}

async function lockDonation(
  tx: Prisma.TransactionClient,
  donationId: string
): Promise<void> {
  const rows =
    await tx.$queryRaw<
      Array<{ id: string }>
    >`
      SELECT "id"
      FROM "Donation"
      WHERE "id" = ${donationId}::uuid
      FOR UPDATE
    `;

  if (rows.length !== 1) {
    throw new FulfillmentError(
      "DONATION_NOT_FOUND"
    );
  }
}

/* ============================================================
   VALIDATION DES LIGNES DE COMMANDE
============================================================ */

function validateOrderLines(
  lines: TicketLine[],
  currency: string,
  expectedSubtotal: bigint
): number {
  if (lines.length === 0) {
    throw new FulfillmentError(
      "ORDER_LINES_EMPTY"
    );
  }

  let subtotal = 0n;
  let quantity = 0;

  const lineIds = new Set<string>();

  for (const line of lines) {
    if (
      !isUuid(line.id) ||
      !isUuid(line.eventId) ||
      !isUuid(line.ticketCategoryId) ||
      lineIds.has(line.id) ||
      !Number.isSafeInteger(line.quantity) ||
      line.quantity < 1 ||
      line.unitPrice < 0n ||
      line.currency !== currency ||
      line.subtotal !==
        BigInt(line.quantity) * line.unitPrice
    ) {
      throw new FulfillmentError(
        "INVALID_ORDER_LINE"
      );
    }

    lineIds.add(line.id);

    subtotal += line.subtotal;
    quantity += line.quantity;

    if (
      quantity > MAX_TICKETS_PER_ORDER
    ) {
      throw new FulfillmentError(
        "ORDER_TICKET_LIMIT_EXCEEDED"
      );
    }
  }

  if (
    quantity < 1 ||
    subtotal !== expectedSubtotal
  ) {
    throw new FulfillmentError(
      "ORDER_TOTAL_MISMATCH"
    );
  }

  return quantity;
}

/* ============================================================
   VÉRIFICATION DES BILLETS EXISTANTS
============================================================ */

/**
 * Lorsqu'une commande est déjà PAID,
 * on vérifie que les billets correspondent
 * bien aux lignes de commande.
 *
 * Une nouvelle confirmation ne crée
 * jamais de nouveaux billets.
 */

function verifyExistingTickets(
  lines: TicketLine[],
  tickets: ExistingTicket[],
  expectedQuantity: number
): void {
  if (
    tickets.length !== expectedQuantity
  ) {
    throw new FulfillmentError(
      "ORDER_FULFILLMENT_INCOMPLETE"
    );
  }

  const linesById =
    new Map(
      lines.map((line) => [
        line.id,
        line,
      ])
    );

  const countByLine =
    new Map<string, number>();

  const ticketIds =
    new Set<string>();

  for (const ticket of tickets) {
    if (
      ticketIds.has(ticket.id)
    ) {
      throw new FulfillmentError(
        "DUPLICATE_TICKET"
      );
    }

    ticketIds.add(ticket.id);

    const line =
      linesById.get(
        ticket.orderLineId
      );

    if (
      !line ||
      ticket.eventId !== line.eventId ||
      ticket.ticketCategoryId !==
        line.ticketCategoryId
    ) {
      throw new FulfillmentError(
        "ORDER_TICKETS_INCONSISTENT"
      );
    }

    countByLine.set(
      line.id,
      (
        countByLine.get(line.id) ?? 0
      ) + 1
    );
  }

  for (const line of lines) {
    if (
      countByLine.get(line.id) !==
      line.quantity
    ) {
      throw new FulfillmentError(
        "ORDER_TICKETS_INCONSISTENT"
      );
    }
  }
}

/* ============================================================
   RÉSERVATIONS ET CAPACITÉ
============================================================ */

/**
 * Les catégories sont verrouillées
 * dans un ordre déterministe.
 *
 * Les réservations doivent être
 * ACTIVE ou CONSUMED.
 *
 * Les quantités doivent correspondre
 * aux lignes de commande.
 *
 * La capacité disponible est revérifiée
 * avant l'émission des billets.
 */

async function consumeReservations(
  tx: Prisma.TransactionClient,
  orderId: string,
  lines: TicketLine[]
): Promise<void> {
  const expected =
    new Map<string, number>();

  for (const line of lines) {
    expected.set(
      line.ticketCategoryId,
      (
        expected.get(
          line.ticketCategoryId
        ) ?? 0
      ) + line.quantity
    );
  }

  const categoryIds =
    [...expected.keys()].sort();

  /* --------------------------------------------------------
     VERROUS DES CATÉGORIES
  -------------------------------------------------------- */

  for (const categoryId of categoryIds) {
    const rows =
      await tx.$queryRaw<
        Array<{ id: string }>
      >`
        SELECT "id"
        FROM "TicketCategory"
        WHERE "id" = ${categoryId}::uuid
        FOR UPDATE
      `;

    if (rows.length !== 1) {
      throw new FulfillmentError(
        "TICKET_CATEGORY_NOT_FOUND"
      );
    }
  }

  /* --------------------------------------------------------
     RÉSERVATIONS
  -------------------------------------------------------- */

  const reservations =
    await tx.inventoryReservation.findMany({
      where: {
        orderId,
      },
    });

  const actual =
    new Map<string, number>();

  for (const reservation of reservations) {
    if (
      reservation.status !== "ACTIVE" &&
      reservation.status !== "CONSUMED"
    ) {
      throw new FulfillmentError(
        "RESERVATION_NOT_VALID"
      );
    }

    actual.set(
      reservation.ticketCategoryId,
      (
        actual.get(
          reservation.ticketCategoryId
        ) ?? 0
      ) + reservation.quantity
    );
  }

  if (
    actual.size !== expected.size
  ) {
    throw new FulfillmentError(
      "RESERVATION_QUANTITY_MISMATCH"
    );
  }

  /* --------------------------------------------------------
     CONTRÔLE DE LA CAPACITÉ
  -------------------------------------------------------- */

  for (const categoryId of categoryIds) {
    const quantity =
      expected.get(categoryId);

    if (quantity === undefined) {
      throw new FulfillmentError(
        "RESERVATION_QUANTITY_MISMATCH"
      );
    }

    if (
      actual.get(categoryId) !==
      quantity
    ) {
      throw new FulfillmentError(
        "RESERVATION_QUANTITY_MISMATCH"
      );
    }

    const category =
      await tx.ticketCategory.findUnique({
        where: {
          id: categoryId,
        },

        select: {
          capacity: true,
        },
      });

    if (!category) {
      throw new FulfillmentError(
        "TICKET_CATEGORY_NOT_FOUND"
      );
    }

    const existingTickets =
      await tx.ticket.count({
        where: {
          ticketCategoryId: categoryId,

          status: {
            notIn: [
              "CANCELLED",
              "REFUNDED",
            ],
          },
        },
      });

    if (
      existingTickets + quantity >
      category.capacity
    ) {
      throw new FulfillmentError(
        "TICKET_CAPACITY_EXCEEDED"
      );
    }
  }

  /* --------------------------------------------------------
     CONSOMMATION
  -------------------------------------------------------- */

  await tx.inventoryReservation.updateMany({
    where: {
      orderId,
      status: "ACTIVE",
    },

    data: {
      status: "CONSUMED",
    },
  });
}

/* ============================================================
   FINALISATION D'UNE COMMANDE DE BILLETS
============================================================ */

async function fulfillTicketOrder(
  tx: Prisma.TransactionClient,
  payment: PaymentRecord
): Promise<FulfillmentResult> {
  if (!payment.orderId) {
    throw new FulfillmentError(
      "PAYMENT_ORDER_MISSING"
    );
  }

  /* --------------------------------------------------------
     VERROU
  -------------------------------------------------------- */

  await lockOrder(
    tx,
    payment.orderId
  );

  /* --------------------------------------------------------
     COMMANDE
  -------------------------------------------------------- */

  const order =
    await tx.order.findUnique({
      where: {
        id: payment.orderId,
      },

      include: {
        lines: true,

        tickets: {
          select: {
            id: true,
            orderLineId: true,
            eventId: true,
            ticketCategoryId: true,
          },
        },
      },
    });

  if (!order) {
    throw new FulfillmentError(
      "ORDER_NOT_FOUND"
    );
  }

  /* --------------------------------------------------------
     CONTRÔLE DU PAIEMENT
  -------------------------------------------------------- */

  if (
    order.currency !== payment.currency ||
    order.total !== payment.amount ||
    !validAmount(payment.amount)
  ) {
    throw new FulfillmentError(
      "ORDER_PAYMENT_MISMATCH"
    );
  }

  /* --------------------------------------------------------
     FRAIS DE SERVICE : 2 %
  -------------------------------------------------------- */

  const expectedFee =
    calculateFee(
      order.subtotal,
      TICKET_SERVICE_FEE_BPS
    );

  if (
    order.serviceFeeBps !==
      TICKET_SERVICE_FEE_BPS ||
    order.serviceFee !== expectedFee ||
    order.total !==
      order.subtotal + expectedFee
  ) {
    throw new FulfillmentError(
      "ORDER_FEE_MISMATCH"
    );
  }

  /* --------------------------------------------------------
     QUANTITÉ ET LIGNES
  -------------------------------------------------------- */

  const quantity =
    validateOrderLines(
      order.lines,
      order.currency,
      order.subtotal
    );

  /* ========================================================
     CAS 1 — COMMANDE DÉJÀ PAYÉE
  ======================================================== */

  if (order.status === "PAID") {
    if (!order.paidAt) {
      throw new FulfillmentError(
        "ORDER_PAID_AT_MISSING"
      );
    }

    verifyExistingTickets(
      order.lines,
      order.tickets,
      quantity
    );

    /*
     * IMPORTANT :
     *
     * Ne jamais recréer les billets.
     *
     * Mais si l'email n'a pas été
     * enregistré, on peut réparer
     * cette absence en toute sécurité.
     */

    const emailQueued =
      await queueTicketOrderEmail(
        tx,
        order
      );

    return {
      success: true,

      paymentId: payment.id,

      type: "tickets",

      resourceId: order.id,

      alreadyFulfilled: true,

      ticketCount: quantity,

      emailQueued,

      completedAt:
        order.paidAt.toISOString(),
    };
  }

  /* ========================================================
     CAS 2 — NOUVELLE COMMANDE PAYÉE
  ======================================================== */

  if (order.status !== "PENDING") {
    throw new FulfillmentError(
      "ORDER_NOT_FULFILLABLE"
    );
  }

  if (
    order.tickets.length !== 0
  ) {
    throw new FulfillmentError(
      "PARTIAL_TICKET_ISSUANCE"
    );
  }

  /* --------------------------------------------------------
     RÉSERVATIONS
  -------------------------------------------------------- */

  await consumeReservations(
    tx,
    order.id,
    order.lines
  );

  /* --------------------------------------------------------
     SÉANCES
  -------------------------------------------------------- */

  const schedules =
    new Map<string, string>();

  for (const line of order.lines) {
    if (
      !schedules.has(line.eventId)
    ) {
      const scheduleId =
        await resolveOrderSchedule(
          tx,
          order.id,
          line.eventId
        );

      schedules.set(
        line.eventId,
        scheduleId
      );
    }
  }

  /* --------------------------------------------------------
     CONSTRUCTION DES BILLETS
  -------------------------------------------------------- */

  const ticketData:
    Prisma.TicketCreateManyInput[] = [];

  for (const line of order.lines) {
    const scheduleId =
      schedules.get(
        line.eventId
      );

    if (!scheduleId) {
      throw new FulfillmentError(
        "TICKET_SCHEDULE_MISSING"
      );
    }

    for (
      let index = 0;
      index < line.quantity;
      index++
    ) {
      const ticketId =
        randomUUID();

      const qrToken =
        createTicketQrToken(
          ticketId
        );

      const qrTokenHash =
        hashTicketQrToken(
          qrToken
        );

      ticketData.push({
        id: ticketId,

        number:
          createTicketNumber(),

        orderId:
          order.id,

        orderLineId:
          line.id,

        eventId:
          line.eventId,

        ticketCategoryId:
          line.ticketCategoryId,

        scheduleId,

        ownerId:
          order.buyerId,

        guestEmail:
          order.guestEmail,

        status: "VALID",

        qrTokenHash,

        pdfStorageKey: null,
      });
    }
  }

  if (
    ticketData.length !== quantity
  ) {
    throw new FulfillmentError(
      "TICKET_GENERATION_MISMATCH"
    );
  }

  /* --------------------------------------------------------
     INSERTION ATOMIQUE DES BILLETS
  -------------------------------------------------------- */

  const created =
    await tx.ticket.createMany({
      data: ticketData,
    });

  if (
    created.count !== quantity
  ) {
    throw new FulfillmentError(
      "TICKET_DATABASE_MISMATCH"
    );
  }

  /* --------------------------------------------------------
     PASSAGE À PAID
  -------------------------------------------------------- */

  const completedAt =
    payment.paidAt ??
    new Date();

  const updated =
    await tx.order.updateMany({
      where: {
        id: order.id,
        status: "PENDING",
      },

      data: {
        status: "PAID",
        paidAt: completedAt,
      },
    });

  if (updated.count !== 1) {
    throw new FulfillmentError(
      "ORDER_STATE_CONFLICT"
    );
  }

  /* --------------------------------------------------------
     EMAIL AUTOMATIQUE
  -------------------------------------------------------- */

  const emailQueued =
    await queueTicketOrderEmail(
      tx,
      order
    );

  return {
    success: true,

    paymentId:
      payment.id,

    type: "tickets",

    resourceId:
      order.id,

    alreadyFulfilled:
      false,

    ticketCount:
      created.count,

    emailQueued,

    completedAt:
      completedAt.toISOString(),
  };
}

/* ============================================================
   FINALISATION D'UN DON
============================================================ */

async function fulfillDonation(
  tx: Prisma.TransactionClient,
  payment: PaymentRecord
): Promise<FulfillmentResult> {
  if (!payment.donationId) {
    throw new FulfillmentError(
      "PAYMENT_DONATION_MISSING"
    );
  }

  /* --------------------------------------------------------
     VERROU
  -------------------------------------------------------- */

  await lockDonation(
    tx,
    payment.donationId
  );

  /* --------------------------------------------------------
     DON
  -------------------------------------------------------- */

  const donation =
    await tx.donation.findUnique({
      where: {
        id: payment.donationId,
      },

      select: {
        id: true,
        reference: true,
        donorId: true,
        donorEmail: true,
        amount: true,
        currency: true,
        status: true,
        confirmedAt: true,
      },
    });

  if (!donation) {
    throw new FulfillmentError(
      "DONATION_NOT_FOUND"
    );
  }

  /* --------------------------------------------------------
     VÉRIFICATION FINANCIÈRE
  -------------------------------------------------------- */

  if (
    !validAmount(
      donation.amount
    ) ||
    donation.currency !==
      payment.currency
  ) {
    throw new FulfillmentError(
      "DONATION_PAYMENT_MISMATCH"
    );
  }

  /* --------------------------------------------------------
     FRAIS DU DON : 1 %
  -------------------------------------------------------- */

  const fee =
    calculateFee(
      donation.amount,
      DONATION_SERVICE_FEE_BPS
    );

  const expectedTotal =
    donation.amount + fee;

  if (
    payment.amount !==
    expectedTotal
  ) {
    throw new FulfillmentError(
      "DONATION_TOTAL_MISMATCH"
    );
  }

  /* ========================================================
     CAS 1 — DON DÉJÀ CONFIRMÉ
  ======================================================== */

  if (
    donation.status === "CONFIRMED"
  ) {
    if (!donation.confirmedAt) {
      throw new FulfillmentError(
        "DONATION_CONFIRMATION_INCOMPLETE"
      );
    }

    /*
     * Ne jamais confirmer deux fois
     * le même don.
     *
     * Une tâche email manquante
     * peut toutefois être recréée.
     */

    const emailQueued =
      await queueDonationEmail(
        tx,
        donation
      );

    return {
      success: true,

      paymentId:
        payment.id,

      type:
        "donation",

      resourceId:
        donation.id,

      alreadyFulfilled:
        true,

      ticketCount:
        0,

      emailQueued,

      completedAt:
        donation.confirmedAt.toISOString(),
    };
  }

  /* ========================================================
     CAS 2 — NOUVEAU DON CONFIRMÉ
  ======================================================== */

  if (
    donation.status !== "PENDING"
  ) {
    throw new FulfillmentError(
      "DONATION_NOT_FULFILLABLE"
    );
  }

  /* --------------------------------------------------------
     CONFIRMATION
  -------------------------------------------------------- */

  const confirmedAt =
    payment.paidAt ??
    new Date();

  const updated =
    await tx.donation.updateMany({
      where: {
        id: donation.id,
        status: "PENDING",
      },

      data: {
        status: "CONFIRMED",
        confirmedAt,
      },
    });

  if (
    updated.count !== 1
  ) {
    throw new FulfillmentError(
      "DONATION_STATE_CONFLICT"
    );
  }

  /* --------------------------------------------------------
     EMAIL DE CONFIRMATION
  -------------------------------------------------------- */

  const emailQueued =
    await queueDonationEmail(
      tx,
      donation
    );

  return {
    success: true,

    paymentId:
      payment.id,

    type: "donation",

    resourceId:
      donation.id,

    alreadyFulfilled:
      false,

    ticketCount:
      0,

    emailQueued,

    completedAt:
      confirmedAt.toISOString(),
  };
}

/* ============================================================
   VALIDATION DU PAIEMENT
============================================================ */

/**
 * La vérification FedaPay doit avoir
 * été effectuée avant cet appel.
 *
 * Le webhook doit avoir :
 *
 * 1. Authentifié la notification.
 * 2. Vérifié la transaction par API.
 * 3. Vérifié le montant et la devise.
 * 4. Enregistré Payment = SUCCEEDED.
 * 5. Enregistré paidAt.
 *
 * Aucun statut PENDING ou FAILED
 * n'est accepté par le fulfillment.
 */

function validatePayment(
  payment: PaymentRecord
): void {
  if (
    payment.status !== "SUCCEEDED" ||
    !payment.paidAt
  ) {
    throw new FulfillmentError(
      "PAYMENT_NOT_CONFIRMED"
    );
  }

  if (
    !validAmount(
      payment.amount
    )
  ) {
    throw new FulfillmentError(
      "INVALID_PAYMENT_AMOUNT"
    );
  }

  if (
    !/^[A-Z]{3}$/.test(
      payment.currency
    )
  ) {
    throw new FulfillmentError(
      "INVALID_PAYMENT_CURRENCY"
    );
  }

  if (
    !payment.reference ||
    !payment.provider
  ) {
    throw new FulfillmentError(
      "INVALID_PAYMENT_REFERENCE"
    );
  }

  if (
    payment.purpose ===
    "TICKET_ORDER"
  ) {
    if (
      !payment.orderId ||
      payment.donationId
    ) {
      throw new FulfillmentError(
        "INVALID_PAYMENT_RESOURCE"
      );
    }

    return;
  }

  if (
    payment.purpose ===
    "DONATION"
  ) {
    if (
      !payment.donationId ||
      payment.orderId
    ) {
      throw new FulfillmentError(
        "INVALID_PAYMENT_RESOURCE"
      );
    }

    return;
  }

  throw new FulfillmentError(
    "UNSUPPORTED_PAYMENT_PURPOSE"
  );
}

/* ============================================================
   FONCTION PRINCIPALE
============================================================ */

/**
 * Appelée par :
 *
 * src/app/api/webhooks/fedapay/route.ts
 *
 * Exemple :
 *
 * await fulfillConfirmedPayment(payment.id);
 *
 * Toutes les opérations liées à la
 * finalisation sont exécutées dans
 * une transaction PostgreSQL.
 *
 * En cas d'échec :
 *
 * - Les nouveaux billets sont annulés.
 * - Les modifications de statut sont annulées.
 * - Les réservations ne sont pas consommées.
 * - La tâche email n'est pas enregistrée.
 *
 * Si le paiement a déjà été finalisé :
 *
 * - Aucun billet supplémentaire.
 * - Aucune seconde confirmation du don.
 * - Aucun nouvel email si la tâche existe.
 * - Réparation possible d'une tâche manquante.
 */

export async function fulfillConfirmedPayment(
  paymentId: string
): Promise<FulfillmentResult> {
  if (!isUuid(paymentId)) {
    throw new FulfillmentError(
      "INVALID_PAYMENT_ID"
    );
  }

  /*
   * Vérification du secret QR
   * avant la transaction.
   */

  const prisma =
    getPlatformPrisma();

  return prisma.$transaction(
    async (tx) => {
      /* ----------------------------------------------------
         VERROU DU PAIEMENT
      ---------------------------------------------------- */

      await lockPayment(
        tx,
        paymentId
      );

      /* ----------------------------------------------------
         LECTURE DU PAIEMENT
      ---------------------------------------------------- */

      const payment =
        await tx.payment.findUnique({
          where: {
            id: paymentId,
          },

          select: {
            id: true,
            reference: true,
            status: true,
            purpose: true,
            provider: true,
            amount: true,
            currency: true,
            paidAt: true,
            orderId: true,
            donationId: true,
          },
        });

      if (!payment) {
        throw new FulfillmentError(
          "PAYMENT_NOT_FOUND"
        );
      }

      /* ----------------------------------------------------
         VALIDATION
      ---------------------------------------------------- */

      validatePayment(
        payment
      );

      /* ----------------------------------------------------
         BILLETS
      ---------------------------------------------------- */

      if (
        payment.purpose ===
        "TICKET_ORDER"
      ) {
        assertQrConfiguration();
        return fulfillTicketOrder(
          tx,
          payment
        );
      }

      /* ----------------------------------------------------
         DON
      ---------------------------------------------------- */

      if (
        payment.purpose ===
        "DONATION"
      ) {
        return fulfillDonation(
          tx,
          payment
        );
      }

      throw new FulfillmentError(
        "UNSUPPORTED_PAYMENT_PURPOSE"
      );
    },

    TRANSACTION_OPTIONS
  );
}
