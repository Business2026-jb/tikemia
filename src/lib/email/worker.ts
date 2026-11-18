
import "server-only";

import { randomUUID } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";

import {
  getPlatformPrisma,
} from "@/lib/payments/fulfillment";

import {
  generateOrderTicketPdfs,
  generateTicketPdf,
  loadStoredEventImage,
  type TicketImageLoader,
} from "@/lib/tickets/pdf";

import {
  clearEmailSnapshot,
  EmailSendError,
  sendTicketPurchaseEmail,
  sendTransferredTicketEmail,
  sendDonationConfirmationEmail,
  makeEmailIdempotencyKey,
  isRetryableEmailError,
  isUnknownEmailOutcome,
} from "@/lib/email/send";

import type {
  EmailLocale,
  TicketPurchaseEmailData,
  DonationConfirmationEmailData,
} from "@/lib/email/templates";

/**
 * ============================================================
 * TIKEMIA — EMAIL DELIVERY WORKER
 * ============================================================
 *
 * src/lib/email/worker.ts
 *
 * Exécution exclusivement côté serveur.
 *
 * Responsabilités :
 *
 * - Récupérer les emails QUEUED et FAILED.
 * - Récupérer les tâches SENDING abandonnées.
 * - Verrouiller les tâches PostgreSQL.
 * - Vérifier les paiements confirmés.
 * - Générer les PDF des billets.
 * - Envoyer les emails de billets.
 * - Envoyer les confirmations de dons.
 * - Enregistrer les identifiants Resend.
 * - Réessayer les erreurs temporaires.
 * - Éviter les traitements concurrents.
 *
 * Le worker n'accepte jamais une confirmation
 * de paiement provenant du navigateur.
 *
 * Les données sont relues dans PostgreSQL.
 *
 * IMPORTANT :
 * EmailDelivery.SENT signifie que le fournisseur
 * a accepté le message. Cela ne prouve pas sa
 * livraison définitive au destinataire.
 * ============================================================
 */

/* ============================================================
   CONFIGURATION
============================================================ */

const MAX_ATTEMPTS = 8;

const DEFAULT_BATCH_SIZE = 10;

const MAX_BATCH_SIZE = 25;

const CANDIDATE_LIMIT = 50;

const LEASE_DURATION_MS =
  10 * 60 * 1000;

const BASE_RETRY_DELAY_MS =
  60 * 1000;

const MAX_RETRY_DELAY_MS =
  6 * 60 * 60 * 1000;

const TRANSACTION_OPTIONS = {
  isolationLevel:
    Prisma.TransactionIsolationLevel.ReadCommitted,

  maxWait: 5000,

  timeout: 15000,
} as const;

const TICKET_TEMPLATE =
  "ticket_purchase";

const DONATION_TEMPLATE =
  "donation_confirmation";

const TICKET_SUBJECT_PREFIX =
  "TIKEMIA | Billets ";

const DONATION_SUBJECT_PREFIX =
  "TIKEMIA | Confirmation du don ";

const LEASE_PREFIX =
  "tikemia:email:lease:";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ============================================================
   TYPES
============================================================ */

export type EmailWorkerOptions = {
  deliveryId?: string;
  /**
   * Nombre maximum d'emails à traiter.
   */
  batchSize?: number;

  /**
   * Fonction de lecture des images stockées
   * dans le système de stockage TIKEMIA.
   *
   * Elle sera transmise au générateur PDF.
   */
  loadEventImage?: TicketImageLoader;
};

export type EmailWorkerResult = {
  processed: number;

  sent: number;

  failed: number;

  retried: number;

  skipped: number;

  exhausted: number;
};

type EmailTemplate =
  | "ticket_purchase"
  | "donation_confirmation";

type DeliveryJob = {
  id: string;
  recipient: string;
  subject: string;
  template: string;
  locale: string;
  attempts: number;
  claimId: string;
};

type LeaseData = {
  claimId?: string;
  state?: string;
  nextAttemptAt?: string;
};

type SendOutcome = {
  providerMessageId: string;
};

class EmailWorkerError extends Error {
  constructor(
    public readonly code: string,
    public readonly retryable = false
  ) {
    super(code);
    this.name = "EmailWorkerError";
  }
}

/* ============================================================
   VALIDATIONS
============================================================ */

function isUuid(
  value: unknown
): value is string {
  return (
    typeof value === "string" &&
    UUID_PATTERN.test(value)
  );
}

function normalizeLocale(
  value: string
): EmailLocale {
  return value === "en"
    ? "en"
    : "fr";
}

function normalizeRecipient(
  value: string
): string {
  return value.trim().toLowerCase();
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function parseLeaseData(
  value: unknown
): LeaseData {
  if (!isRecord(value)) {
    return {};
  }

  return {
    claimId:
      typeof value.claimId === "string"
        ? value.claimId
        : undefined,

    state:
      typeof value.state === "string"
        ? value.state
        : undefined,

    nextAttemptAt:
      typeof value.nextAttemptAt === "string"
        ? value.nextAttemptAt
        : undefined,
  };
}

/* ============================================================
   PARAMÈTRES DU WORKER
============================================================ */

function normalizeBatchSize(
  value: number | undefined
): number {
  if (value === undefined) {
    return DEFAULT_BATCH_SIZE;
  }

  if (
    !Number.isInteger(value) ||
    value < 1 ||
    value > MAX_BATCH_SIZE
  ) {
    throw new EmailWorkerError(
      "INVALID_BATCH_SIZE"
    );
  }

  return value;
}

/* ============================================================
   CALCUL DU DÉLAI DE REPRISE
============================================================ */

/**
 * Reprises progressives :
 *
 * 1 min
 * 2 min
 * 4 min
 * 8 min
 * 16 min
 * 32 min
 * 64 min
 * 128 min
 *
 * Plafond : 6 heures.
 *
 * La clé d'idempotence reste identique
 * pendant toutes les tentatives.
 */

function retryDelay(
  attempts: number
): number {
  const exponent =
    Math.min(
      Math.max(attempts - 1, 0),
      12
    );

  return Math.min(
    BASE_RETRY_DELAY_MS *
      2 ** exponent,
    MAX_RETRY_DELAY_MS
  );
}

/* ============================================================
   IDENTIFIANT DE VERROU
============================================================ */

function leaseKey(
  deliveryId: string
): string {
  if (!isUuid(deliveryId)) {
    throw new EmailWorkerError(
      "INVALID_DELIVERY_ID"
    );
  }

  return `${LEASE_PREFIX}${deliveryId}`;
}

/* ============================================================
   RÉCUPÉRATION ATOMIQUE D'UNE TÂCHE
============================================================ */

/**
 * PostgreSQL :
 *
 * SELECT ... FOR UPDATE SKIP LOCKED
 *
 * Deux workers concurrents ne peuvent
 * pas sélectionner simultanément la même
 * ligne EmailDelivery.
 *
 * La table AppSetting sert ici à stocker :
 *
 * - L'identifiant du traitement.
 * - La date du verrou.
 * - La prochaine date de tentative.
 *
 * Cela évite de modifier immédiatement
 * le modèle EmailDelivery existant.
 */

async function claimEmailJob(deliveryId?: string):
  Promise<DeliveryJob | null> {
  const prisma =
    getPlatformPrisma();

  return prisma.$transaction(
    async (tx) => {
      const rows =
        await tx.$queryRaw<
          Array<{ id: string }>
        >`
          SELECT "id"
          FROM "EmailDelivery"
          WHERE "status" IN (
            'QUEUED',
            'FAILED',
            'SENDING'
          )
          AND "attempts" < ${MAX_ATTEMPTS}
          AND (${deliveryId ?? null}::uuid IS NULL OR "id" = ${deliveryId ?? null}::uuid)
          ORDER BY "createdAt" ASC
          LIMIT ${CANDIDATE_LIMIT}
          FOR UPDATE SKIP LOCKED
        `;

      const now = new Date();

      for (const row of rows) {
        const delivery =
          await tx.emailDelivery.findUnique({
            where: {
              id: row.id,
            },

            select: {
              id: true,
              recipient: true,
              subject: true,
              template: true,
              locale: true,
              status: true,
              attempts: true,
            },
          });

        if (!delivery) {
          continue;
        }

        const key =
          leaseKey(delivery.id);

        const lease =
          await tx.appSetting.findUnique({
            where: {
              key,
            },

            select: {
              value: true,
              updatedAt: true,
            },
          });

        const leaseData =
          parseLeaseData(
            lease?.value
          );

        /* ==================================================
           TÂCHE DÉJÀ EN COURS
        ================================================== */

        if (
          delivery.status === "SENDING"
        ) {
          /*
           * Un traitement actif n'est jamais
           * repris avant expiration du verrou.
           *
           * Si aucun verrou n'existe alors que
           * le statut est SENDING, on refuse
           * de reprendre automatiquement :
           * le résultat est incertain.
           */

          if (!lease) {
            continue;
          }

          const age =
            now.getTime() -
            lease.updatedAt.getTime();

          if (
            age < LEASE_DURATION_MS
          ) {
            continue;
          }
        }

        /* ==================================================
           DÉLAI DE RETENTATIVE
        ================================================== */

        if (
          delivery.status === "FAILED" &&
          leaseData.nextAttemptAt
        ) {
          const nextAttempt =
            new Date(
              leaseData.nextAttemptAt
            );

          if (
            Number.isFinite(
              nextAttempt.getTime()
            ) &&
            nextAttempt > now
          ) {
            continue;
          }
        }

        /* ==================================================
           ENREGISTRER LE VERROU
        ================================================== */

        const claimId =
          randomUUID();

        await tx.appSetting.upsert({
          where: {
            key,
          },

          create: {
            key,

            value: {
              state: "sending",
              claimId,
            },
          },

          update: {
            value: {
              state: "sending",
              claimId,
            },
          },
        });

        /* ==================================================
           MARQUER COMME EN COURS
        ================================================== */

        const update =
          await tx.emailDelivery.updateMany({
            where: {
              id: delivery.id,
              status: delivery.status,
              attempts:
                delivery.attempts,
            },

            data: {
              status: "SENDING",

              attempts: {
                increment: 1,
              },
            },
          });

        if (update.count !== 1) {
          continue;
        }

        return {
          id:
            delivery.id,

          recipient:
            delivery.recipient,

          subject:
            delivery.subject,

          template:
            delivery.template,

          locale:
            delivery.locale,

          attempts:
            delivery.attempts + 1,

          claimId,
        };
      }

      return null;
    },

    TRANSACTION_OPTIONS
  );
}

/* ============================================================
   VÉRIFICATION DU VERROU
============================================================ */

async function verifyLease(
  tx: Prisma.TransactionClient,
  job: DeliveryJob
): Promise<boolean> {
  const lease =
    await tx.appSetting.findUnique({
      where: {
        key: leaseKey(job.id),
      },

      select: {
        value: true,
      },
    });

  const data =
    parseLeaseData(
      lease?.value
    );

  return (
    data.claimId === job.claimId &&
    data.state === "sending"
  );
}

/* ============================================================
   MARQUER UN EMAIL COMME ACCEPTÉ
============================================================ */

/**
 * SENT signifie ici :
 * Resend a accepté la demande.
 *
 * Ce n'est pas une preuve de livraison.
 *
 * providerMessageId contient la vraie
 * référence renvoyée par Resend.
 */

async function markEmailSent(
  job: DeliveryJob,
  providerMessageId: string
): Promise<boolean> {
  const prisma =
    getPlatformPrisma();

  return prisma.$transaction(
    async (tx) => {
      if (
        !(await verifyLease(tx, job))
      ) {
        return false;
      }

      const result =
        await tx.emailDelivery.updateMany({
          where: {
            id: job.id,
            status: "SENDING",
            attempts: job.attempts,
          },

          data: {
            status: "SENT",

            providerMessageId,

            sentAt: new Date(),
          },
        });

      if (result.count !== 1) {
        return false;
      }

      await tx.appSetting.update({
        where: {
          key: leaseKey(job.id),
        },

        data: {
          value: {
            state: "completed",
            claimId: job.claimId,
          },
        },
      });

      return true;
    },

    TRANSACTION_OPTIONS
  );
}

/* ============================================================
   GESTION D'UN ÉCHEC
============================================================ */

async function markEmailFailed(
  job: DeliveryJob,
  retryable: boolean
): Promise<boolean> {
  const prisma =
    getPlatformPrisma();

  return prisma.$transaction(
    async (tx) => {
      if (
        !(await verifyLease(tx, job))
      ) {
        return false;
      }

      const canRetry =
        retryable &&
        job.attempts < MAX_ATTEMPTS;

      const nextAttemptAt =
        canRetry
          ? new Date(
              Date.now() +
                retryDelay(
                  job.attempts
                )
            ).toISOString()
          : null;

      const result =
        await tx.emailDelivery.updateMany({
          where: {
            id: job.id,

            status: "SENDING",

            attempts:
              job.attempts,
          },

          data: {
            status: "FAILED",
          },
        });

      if (result.count !== 1) {
        return false;
      }

      await tx.appSetting.update({
        where: {
          key: leaseKey(job.id),
        },

        data: {
          value: {
            state:
              canRetry
                ? "retry"
                : "exhausted",

            claimId:
              job.claimId,

            nextAttemptAt,
          },
        },
      });

      return true;
    },

    TRANSACTION_OPTIONS
  );
}

/* ============================================================
   IDENTIFIER LA RESSOURCE
============================================================ */

/**
 * Les tâches existantes créées par
 * fulfillment.ts utilisent :
 *
 * TIKEMIA | Billets <order.reference>
 *
 * ou
 *
 * TIKEMIA | Confirmation du don <donation.reference>
 *
 * Le schéma EmailDelivery ne possède pas
 * encore orderId ou donationId.
 *
 * On utilise donc la référence exacte
 * enregistrée dans le sujet.
 *
 * Aucune recherche approximative.
 */

function extractReference(
  job: DeliveryJob,
  template: EmailTemplate
): string {
  const prefix =
    template === "ticket_purchase"
      ? TICKET_SUBJECT_PREFIX
      : DONATION_SUBJECT_PREFIX;

  if (
    !job.subject.startsWith(prefix)
  ) {
    throw new EmailWorkerError(
      "INVALID_DELIVERY_SUBJECT"
    );
  }

  const reference =
    job.subject.slice(
      prefix.length
    ).trim();

  if (
    reference.length < 1 ||
    reference.length > 120 ||
    /[\r\n\x00-\x1F]/.test(reference)
  ) {
    throw new EmailWorkerError(
      "INVALID_RESOURCE_REFERENCE"
    );
  }

  return reference;
}

/* ============================================================
   VÉRIFICATION DU PAIEMENT
============================================================ */

function successfulPayment(
  payments: ReadonlyArray<{
    status: string;
    paidAt: Date | null;
    amount: bigint;
    currency: string;
  }>,
  amount: bigint,
  currency: string
): boolean {
  return payments.some(
    (payment) =>
      payment.status === "SUCCEEDED" &&
      payment.paidAt !== null &&
      payment.amount === amount &&
      payment.currency === currency
  );
}

/* ============================================================
   EMAIL DE BILLETS
============================================================ */

/**
 * Le worker refuse d'envoyer si :
 *
 * - La commande n'existe pas.
 * - La commande n'est pas PAID.
 * - Aucun paiement SUCCEEDED ne correspond.
 * - Le nombre de billets ne correspond pas.
 * - Les billets appartiennent à plusieurs
 *   événements incompatibles avec le modèle.
 * - Le destinataire ne correspond pas.
 * - Le QR ou le PDF est invalide.
 *
 * Il n'invente aucune donnée.
 */

async function processTicketEmail(
  job: DeliveryJob,
  options: EmailWorkerOptions
): Promise<SendOutcome> {
  const reference =
    extractReference(
      job,
      TICKET_TEMPLATE
    );

  const prisma =
    getPlatformPrisma();

  const order =
    await prisma.order.findUnique({
      where: {
        reference,
      },

      include: {
        lines: true,

        tickets: {
          include: {
            transfers: { where: { status: "ACCEPTED" }, take: 1, select: { id: true } },
            category: {
              select: {
                name: true,
              },
            },

            schedule: {
              select: {
                startsAt: true,
              },
            },

            event: {
              select: {
                id: true,
                title: true,
                timeZone: true,

                venue: {
                  select: {
                    name: true,
                    address: true,
                    city: true,
                    country: true,
                  },
                },

                images: {
                  take: 1,

                  orderBy: [
                    {
                      isPrimary: "desc",
                    },
                    {
                      position: "asc",
                    },
                  ],

                  select: {
                    storageKey: true,
                  },
                },
              },
            },
          },
        },

        payments: {
          select: {
            status: true,
            paidAt: true,
            amount: true,
            currency: true,
          },
        },

        buyer: {
          select: {
            fullName: true,
            preferredLocale: true,
          },
        },
      },
    });

  /* ========================================================
     COMMANDE PAYÉE
  ======================================================== */

  if (
    !order ||
    order.status !== "PAID" ||
    !order.paidAt
  ) {
    throw new EmailWorkerError(
      "ORDER_NOT_PAID",
      true
    );
  }

  /* ========================================================
     DESTINATAIRE
  ======================================================== */

  const recipient =
    normalizeRecipient(
      order.guestEmail
    );

  if (
    recipient !==
    normalizeRecipient(job.recipient)
  ) {
    throw new EmailWorkerError(
      "RECIPIENT_MISMATCH"
    );
  }

  /* ========================================================
     PAIEMENT RÉEL
  ======================================================== */

  if (
    !successfulPayment(
      order.payments,
      order.total,
      order.currency
    )
  ) {
    throw new EmailWorkerError(
      "PAYMENT_NOT_CONFIRMED",
      true
    );
  }

  /* ========================================================
     QUANTITÉ
  ======================================================== */

  const expectedQuantity =
    order.lines.reduce(
      (total, line) =>
        total + line.quantity,
      0
    );

  if (
    expectedQuantity <= 0 ||
    order.tickets.length !==
      expectedQuantity
  ) {
    throw new EmailWorkerError(
      "TICKETS_NOT_READY",
      true
    );
  }

  /* ========================================================
     CONTRÔLE DE CHAQUE BILLET
  ======================================================== */

  const countByLine =
    new Map<string, number>();

  const validLineIds =
    new Set(
      order.lines.map(
        (line) => line.id
      )
    );

  for (const ticket of order.tickets) {
    if (
      ticket.orderId !== order.id ||
      ticket.transfers.length > 0 ||
      ticket.status !== "VALID" ||
      ticket.usedAt !== null ||
      !validLineIds.has(
        ticket.orderLineId
      )
    ) {
      throw new EmailWorkerError(
        "TICKET_STATE_INVALID"
      );
    }

    countByLine.set(
      ticket.orderLineId,
      (
        countByLine.get(
          ticket.orderLineId
        ) ?? 0
      ) + 1
    );
  }

  for (const line of order.lines) {
    if (
      countByLine.get(line.id) !==
      line.quantity
    ) {
      throw new EmailWorkerError(
        "TICKET_QUANTITY_MISMATCH",
        true
      );
    }
  }

  /* ========================================================
     IDENTIFICATION DE L'ÉVÉNEMENT
  ======================================================== */

  const eventIds =
    new Set(
      order.tickets.map(
        (ticket) =>
          ticket.eventId
      )
    );

  /*
   * Le modèle d'email existant présente
   * un seul événement.
   *
   * On refuse de mélanger les détails
   * de plusieurs événements.
   */

  if (eventIds.size !== 1) {
    throw new EmailWorkerError(
      "MULTI_EVENT_EMAIL_NOT_SUPPORTED"
    );
  }

  const firstTicket =
    order.tickets[0];

  if (!firstTicket) {
    throw new EmailWorkerError(
      "TICKET_NOT_FOUND"
    );
  }

  const event =
    firstTicket.event;

  /* ========================================================
     DATE DE L'ÉVÉNEMENT
  ======================================================== */

  const startsAt =
    firstTicket.schedule?.startsAt;

  if (!startsAt) {
    throw new EmailWorkerError(
      "EVENT_SCHEDULE_MISSING"
    );
  }

  /*
   * La liste présente une seule date/heure.
   * Les séances doivent donc correspondre.
   */

  for (const ticket of order.tickets) {
    if (
      !ticket.schedule?.startsAt ||
      ticket.schedule.startsAt.getTime() !==
        startsAt.getTime()
    ) {
      throw new EmailWorkerError(
        "MULTIPLE_SCHEDULES_NOT_SUPPORTED"
      );
    }
  }

  /* ========================================================
     IMAGE OFFICIELLE
  ======================================================== */

  /*
   * Si une image existe mais qu'aucun
   * chargeur de stockage n'est configuré,
   * ne pas envoyer silencieusement
   * un PDF privé de son image officielle.
   */

  if (
    event.images.length > 0 &&
    !options.loadEventImage
  ) {
    throw new EmailWorkerError(
      "EVENT_IMAGE_STORAGE_NOT_CONFIGURED"
    );
  }

  /* ========================================================
     IDENTITÉ DU TITULAIRE
  ======================================================== */

  if (
    !order.guestEmail ||
    !order.guestPhoneE164
  ) {
    throw new EmailWorkerError(
      "TICKET_HOLDER_CONTACT_MISSING"
    );
  }

  /* ========================================================
     GÉNÉRATION DES PDF
  ======================================================== */

  const locale =
    normalizeLocale(
      job.locale
    );

  const pdfs =
    await generateOrderTicketPdfs(
      order.id,
      {
        locale,

        loadEventImage:
          options.loadEventImage,

        requireEventImage:
          event.images.length > 0,
      }
    );

  if (
    pdfs.length !== expectedQuantity
  ) {
    throw new EmailWorkerError(
      "PDF_COUNT_MISMATCH",
      true
    );
  }

  /* ========================================================
     PRÉPARATION DE L'EMAIL
  ======================================================== */

  const venue =
    event.venue;

  const venueText =
    venue
      ? [
          venue.name,
          venue.address,
          venue.city,
          venue.country,
        ]
          .filter(Boolean)
          .join(", ")
      : null;

  const ticketData:
    TicketPurchaseEmailData = {
      locale,

      recipientEmail:
        recipient,

      holderEmail:
        order.guestEmail,

      holderPhone:
        order.guestPhoneE164,

      holderName:
        order.buyer?.fullName ?? null,

      orderReference:
        order.reference,

      eventTitle:
        event.title,

      eventStartsAt:
        startsAt,

      eventTimeZone:
        event.timeZone,

      eventVenue:
        venueText,

      tickets:
        order.tickets.map(
          (ticket) => ({
            ticketNumber:
              ticket.number,

            category:
              ticket.category.name,
          })
        ),

      totalMinor:
        order.total.toString(),

      currency:
        order.currency,
    };

  /* ========================================================
     ENVOI RÉEL
  ======================================================== */

  if (await prisma.ticket.count({ where: { orderId: order.id, transfers: { some: { status: "ACCEPTED" } } } })) throw new EmailWorkerError("TICKET_OWNERSHIP_CHANGED");

  const result =
    await sendTicketPurchaseEmail({
      data:
        ticketData,

      pdfs,

      idempotencyKey:
        makeEmailIdempotencyKey(
          job.id,
          TICKET_TEMPLATE
        ),
    });

  return {
    providerMessageId:
      result.providerMessageId,
  };
}

/* ============================================================
   EMAIL DE CONFIRMATION DU DON
============================================================ */

/**
 * Le don doit être :
 *
 * - Enregistré dans PostgreSQL.
 * - Confirmé.
 * - Associé à un paiement SUCCEEDED.
 * - Associé au bon destinataire.
 *
 * Aucun email de confirmation n'est
 * envoyé pour un paiement PENDING.
 */

async function processDonationEmail(
  job: DeliveryJob
): Promise<SendOutcome> {
  const reference =
    extractReference(
      job,
      DONATION_TEMPLATE
    );

  const prisma =
    getPlatformPrisma();

  const donation =
    await prisma.donation.findUnique({
      where: {
        reference,
      },

      include: {
        campaign: {
          select: {
            title: true,
            slug: true,
          },
        },

        donor: {
          select: {
            preferredLocale: true,
          },
        },

        payments: {
          select: {
            status: true,
            paidAt: true,
            amount: true,
            currency: true,
          },
        },
      },
    });

  /* ========================================================
     DON CONFIRMÉ
  ======================================================== */

  if (
    !donation ||
    donation.status !== "CONFIRMED" ||
    !donation.confirmedAt
  ) {
    throw new EmailWorkerError(
      "DONATION_NOT_CONFIRMED",
      true
    );
  }

  /* ========================================================
     DESTINATAIRE
  ======================================================== */

  const recipient =
    donation.donorEmail
      ? normalizeRecipient(
          donation.donorEmail
        )
      : null;

  if (
    !recipient ||
    recipient !==
      normalizeRecipient(
        job.recipient
      )
  ) {
    throw new EmailWorkerError(
      "DONATION_RECIPIENT_MISMATCH"
    );
  }

  /* ========================================================
     CONTRÔLE DU MONTANT
  ======================================================== */

  const fee =
    (
      donation.amount * 100n +
      5000n
    ) / 10000n;

  const totalPaid =
    donation.amount + fee;

  if (
    !successfulPayment(
      donation.payments,
      totalPaid,
      donation.currency
    )
  ) {
    throw new EmailWorkerError(
      "DONATION_PAYMENT_NOT_CONFIRMED",
      true
    );
  }

  /* ========================================================
     MODÈLE EMAIL
  ======================================================== */

  const locale =
    normalizeLocale(
      job.locale
    );

  const data:
    DonationConfirmationEmailData = {
      locale,

      recipientEmail:
        recipient,

      donorName:
        donation.donorName,

      donationReference:
        donation.reference,

      campaignTitle:
        donation.campaign.title,

      amountMinor:
        donation.amount.toString(),

      currency:
        donation.currency,

      confirmedAt:
        donation.confirmedAt,

      totalPaidMinor:
        totalPaid.toString(),
    };

  /* ========================================================
     ENVOI RÉEL
  ======================================================== */

  const result =
    await sendDonationConfirmationEmail({
      data,

      idempotencyKey:
        makeEmailIdempotencyKey(
          job.id,
          DONATION_TEMPLATE
        ),
    });

  return {
    providerMessageId:
      result.providerMessageId,
  };
}

/* ============================================================
   ROUTAGE DU MODÈLE
============================================================ */

async function processTransferredTickets(job: DeliveryJob, options: EmailWorkerOptions): Promise<SendOutcome> {
 const db = getPlatformPrisma();
 const audit = await db.auditLog.findFirst({ where: { action: "TICKET_TRANSFER_CONFIRMED", entity: "EmailDelivery", entityId: job.id }, orderBy: { createdAt: "desc" }, select: { metadata: true } });
 const metadata = audit?.metadata as { ticketIds?: unknown } | undefined;
 if (!Array.isArray(metadata?.ticketIds) || metadata.ticketIds.length < 1 || metadata.ticketIds.length > 100 || !metadata.ticketIds.every(id => typeof id === "string" && /^[a-f0-9-]{36}$/.test(id))) throw new EmailWorkerError("TRANSFER_CONTEXT_MISSING");
 const tickets = await db.ticket.findMany({ where: { id: { in: metadata.ticketIds as string[] } }, include: { owner: true, transfers: { where: { status: "ACCEPTED" }, orderBy: [{ acceptedAt: "desc" }, { id: "desc" }], take: 1 }, order: { include: { payments: true } }, orderLine: true, category: true, schedule: true, event: { include: { venue: true } } } });
 if (tickets.length !== metadata.ticketIds.length || tickets.some(ticket => ticket.status !== "VALID" || ticket.usedAt || ticket.order.status !== "PAID" || !ticket.order.payments.some(payment => payment.status === "SUCCEEDED" && payment.paidAt && payment.amount === ticket.order.total && payment.currency === ticket.order.currency) || ticket.transfers[0]?.recipientEmail.toLowerCase() !== job.recipient.toLowerCase() || (ticket.owner?.email || ticket.guestEmail || "").toLowerCase() !== job.recipient.toLowerCase())) throw new EmailWorkerError("TRANSFER_OWNERSHIP_CHANGED");
 const first = tickets[0], startsAt = first.schedule?.startsAt;
 if (!startsAt || tickets.some(ticket => ticket.orderLine.currency !== first.orderLine.currency)) throw new EmailWorkerError("TRANSFER_CONTEXT_INVALID");
 const pdfs = await Promise.all(tickets.map(ticket => generateTicketPdf(ticket.id, { locale: normalizeLocale(job.locale), loadEventImage: options.loadEventImage ?? loadStoredEventImage })));
 // Recheck current ownership after PDF preparation, before submitting to the mail provider.
 const current = await db.ticket.findMany({ where: { id: { in: tickets.map(ticket => ticket.id) } }, select: { id: true, ownerId: true, guestEmail: true, status: true, transfers: { where: { status: "ACCEPTED" }, orderBy: [{ acceptedAt: "desc" }, { id: "desc" }], take: 1, select: { id: true } } } });
 if (current.length !== tickets.length || current.some(ticket => { const original = tickets.find(original => original.id === ticket.id); return !original || ticket.ownerId !== original.ownerId || ticket.guestEmail !== original.guestEmail || ticket.status !== "VALID" || ticket.transfers[0]?.id !== original.transfers[0]?.id; })) throw new EmailWorkerError("TRANSFER_CHANGED_DURING_DELIVERY", true);
 const result = await sendTransferredTicketEmail({ data: { locale: normalizeLocale(job.locale), recipientEmail: job.recipient, holderEmail: job.recipient, holderPhone: first.owner?.phoneE164 || "", orderReference: first.order.reference, eventTitle: [...new Set(tickets.map(ticket => ticket.event.title))].join(" / "), eventStartsAt: startsAt, eventTimeZone: first.event.timeZone, eventVenue: first.event.venue?.name, tickets: tickets.map(ticket => ({ ticketNumber: ticket.number, category: ticket.orderLine.categoryName })), totalMinor: tickets.reduce((sum,ticket) => sum + ticket.orderLine.unitPrice, 0n).toString(), currency: first.orderLine.currency }, pdfs, idempotencyKey: makeEmailIdempotencyKey(job.id, TICKET_TEMPLATE) });
 return { providerMessageId: result.providerMessageId };
}

async function processDelivery(
  job: DeliveryJob,
  options: EmailWorkerOptions
): Promise<SendOutcome> {
  switch (job.template) {
    case "TICKET_TRANSFER_PDF": return processTransferredTickets(job, options);
    case TICKET_TEMPLATE:
      return processTicketEmail(
        job,
        options
      );

    case DONATION_TEMPLATE:
      return processDonationEmail(
        job
      );

    default:
      throw new EmailWorkerError(
        "UNSUPPORTED_EMAIL_TEMPLATE"
      );
  }
}

/* ============================================================
   CLASSIFICATION DES ERREURS
============================================================ */

function shouldRetry(
  error: unknown
): boolean {
  if (
    error instanceof EmailWorkerError
  ) {
    return error.retryable;
  }

  if (
    isRetryableEmailError(error)
  ) {
    return true;
  }

  /*
   * Résultat réseau incertain :
   *
   * Une nouvelle tentative conserve
   * la même clé d'idempotence.
   */

  if (
    isUnknownEmailOutcome(error)
  ) {
    return true;
  }

  return false;
}

/* ============================================================
   TRAITEMENT D'UNE TÂCHE
============================================================ */

async function executeJob(
  job: DeliveryJob,
  options: EmailWorkerOptions
): Promise<
  | "sent"
  | "retried"
  | "failed"
  | "exhausted"
  | "skipped"
> {
  try {
    const outcome =
      await processDelivery(
        job,
        options
      );

    const saved =
      await markEmailSent(
        job,
        outcome.providerMessageId
      );

    if (!saved) {
      return "skipped";
    }

    try { await clearEmailSnapshot(makeEmailIdempotencyKey(job.id, job.template === "TICKET_TRANSFER_PDF" ? TICKET_TEMPLATE : job.template)); } catch { /* Delivery is already committed; cleanup must not mark it failed. */ }
    return "sent";
  } catch (error) {
    const retryable =
      shouldRetry(error);

    const saved =
      await markEmailFailed(
        job,
        retryable
      );

    /*
     * Ne jamais journaliser :
     * - L'adresse email
     * - Le téléphone
     * - Le contenu PDF
     * - Les clés API
     * - Le QR code
     */

    console.error(
      "[TIKEMIA_EMAIL_WORKER]",
      {
        deliveryId: job.id,

        code:
          error instanceof EmailWorkerError || error instanceof EmailSendError
            ? error.code
            : error instanceof Error
              ? error.name
              : "UNKNOWN_ERROR",

        httpStatus: error instanceof EmailSendError ? error.httpStatus : null,
        retryable,
      }
    );

    if (!saved) {
      return "skipped";
    }

    if (!retryable) {
      return "failed";
    }

    if (
      job.attempts >= MAX_ATTEMPTS
    ) {
      return "exhausted";
    }

    return "retried";
  }
}

/* ============================================================
   FONCTION PRINCIPALE DU WORKER
============================================================ */

/**
 * Appel prévu depuis :
 *
 * src/app/api/cron/emails/route.ts
 *
 * Exemple :
 *
 * const result = await runEmailWorker({
 *   batchSize: 10,
 *   loadEventImage: storageLoader,
 * });
 *
 * Le cron doit être authentifié.
 *
 * Ne jamais rendre cette fonction
 * directement accessible à un client.
 *
 * Le worker ne crée :
 * - Aucun paiement
 * - Aucun don
 * - Aucun billet
 *
 * Il prépare les PDF à partir des billets
 * existants et réalise les envois.
 */

export async function runEmailWorker(
  options: EmailWorkerOptions = {}
): Promise<EmailWorkerResult> {
  if (options.deliveryId && !UUID_PATTERN.test(options.deliveryId)) throw new EmailWorkerError("INVALID_DELIVERY_ID");
  options = { ...options, loadEventImage: options.loadEventImage ?? loadStoredEventImage };
  const batchSize =
    normalizeBatchSize(
      options.batchSize
    );

  const result:
    EmailWorkerResult = {
      processed: 0,

      sent: 0,

      failed: 0,

      retried: 0,

      skipped: 0,

      exhausted: 0,
    };

  const startedAt = Date.now();
  for (
    let index = 0;
    index < batchSize && Date.now() - startedAt < 45000;
    index++
  ) {
    const job =
      await claimEmailJob(options.deliveryId);

    if (!job) {
      break;
    }

    result.processed++;

    const outcome =
      await executeJob(
        job,
        options
      );

    switch (outcome) {
      case "sent":
        result.sent++;
        break;

      case "retried":
        result.retried++;
        break;

      case "failed":
        result.failed++;
        break;

      case "exhausted":
        result.exhausted++;
        break;

      case "skipped":
        result.skipped++;
        break;
    }
  }

  return result;
}
