import { parseTicketQrToken, verifyTicketQrSignature } from "@/lib/tickets/qr";

import "server-only";

import {
  createHash,
  timingSafeEqual,
} from "node:crypto";

import { getPlatformPrisma } from "@/lib/payments/fulfillment";

/**
 * ============================================================
 * TIKEMIA — MOTEUR DE VALIDATION DES BILLETS
 * ============================================================
 *
 * Fichier : src/lib/scanner.ts
 *
 * Compatible avec :
 * - Next.js App Router
 * - Prisma 7
 * - PostgreSQL
 * - Billets QR TIKEMIA v1
 * - Plusieurs agents de contrôle
 *
 * SÉCURITÉ :
 * - Validation exclusivement côté serveur
 * - Authentification fournie par l'API appelante
 * - Vérification des autorisations en base
 * - Signature HMAC-SHA256
 * - Vérification du hash du QR
 * - Vérification des paiements
 * - Validation atomique anti-double entrée
 * - Historique des tentatives
 * - Aucun stockage en mémoire des billets
 *
 * ============================================================
 */

/* ============================================================
   TYPES PUBLICS
============================================================ */

export type ScannerLanguage = "fr" | "en";

export type ScannerResultCode =
  | "VALID"
  | "ALREADY_USED"
  | "INVALID"
  | "WRONG_EVENT"
  | "CANCELLED"
  | "EXPIRED"
  | "BLOCKED"
  | "TRANSFERRED"
  | "TRANSFER_PENDING"
  | "UNPAID"
  | "UNAUTHORIZED";

export type ScannerInput = {
  eventId: string;
  scannedById: string;
  qrCode: string;
  locale?: ScannerLanguage;
};

export type ScannerTicketInfo = {
  id: string;
  number: string;
  eventId: string;
  eventTitle: string;
  category: string;
  holder: string | null;
  usedAt: string | null;
};

export type ScannerResponse = {
  success: boolean;
  allowed: boolean;
  code: ScannerResultCode;
  message: string;
  description: string;
  scannedAt: string;
  ticket: ScannerTicketInfo | null;
};

export class ScannerError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(
    code: string,
    status = 500,
  ) {
    super(code);

    this.name = "ScannerError";
    this.code = code;
    this.status = status;
  }
}

/* ============================================================
   CONFIGURATION
============================================================ */





const MAX_QR_LENGTH = 512;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const HEX_SHA256_PATTERN = /^[0-9a-f]{64}$/i;

/**
 * Messages courts adaptés au scan continu.
 *
 * L'interface peut afficher chaque résultat
 * brièvement, puis poursuivre automatiquement.
 */
const MESSAGES = {
  fr: {
    VALID: [
      "Billet valide",
      "Entrée autorisée.",
    ],
    ALREADY_USED: [
      "Billet déjà utilisé",
      "Ce billet a déjà été validé.",
    ],
    INVALID: [
      "Billet invalide",
      "QR code inconnu ou non authentique.",
    ],
    WRONG_EVENT: [
      "Mauvais événement",
      "Ce billet appartient à un autre événement.",
    ],
    CANCELLED: [
      "Billet annulé",
      "Ce billet n'est plus valable.",
    ],
    EXPIRED: [
      "Billet expiré",
      "Ce billet n'est plus valable.",
    ],
    BLOCKED: [
      "Billet bloqué",
      "L'accès est refusé pour ce billet.",
    ],
    TRANSFERRED: [
      "Billet transféré",
      "Ce billet a été transféré.",
    ],
    TRANSFER_PENDING: [
      "Transfert en cours",
      "Ce billet ne peut pas être utilisé actuellement.",
    ],
    UNPAID: [
      "Paiement non confirmé",
      "La commande associée n'est pas confirmée.",
    ],
    UNAUTHORIZED: [
      "Accès non autorisé",
      "Vous n'avez pas l'autorisation de scanner cet événement.",
    ],
  },

  en: {
    VALID: [
      "Valid ticket",
      "Entry authorized.",
    ],
    ALREADY_USED: [
      "Ticket already used",
      "This ticket has already been checked in.",
    ],
    INVALID: [
      "Invalid ticket",
      "Unknown or unauthentic QR code.",
    ],
    WRONG_EVENT: [
      "Wrong event",
      "This ticket belongs to another event.",
    ],
    CANCELLED: [
      "Cancelled ticket",
      "This ticket is no longer valid.",
    ],
    EXPIRED: [
      "Expired ticket",
      "This ticket is no longer valid.",
    ],
    BLOCKED: [
      "Blocked ticket",
      "Access is denied for this ticket.",
    ],
    TRANSFERRED: [
      "Transferred ticket",
      "This ticket has been transferred.",
    ],
    TRANSFER_PENDING: [
      "Transfer pending",
      "This ticket cannot currently be used.",
    ],
    UNPAID: [
      "Payment not confirmed",
      "The associated order is not confirmed.",
    ],
    UNAUTHORIZED: [
      "Unauthorized access",
      "You cannot scan tickets for this event.",
    ],
  },
} as const;

/* ============================================================
   UTILITAIRES
============================================================ */

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function sha256(value: string): string {
  return createHash("sha256")
    .update(value, "utf8")
    .digest("hex");
}



function getLanguage(
  value?: ScannerLanguage,
): ScannerLanguage {
  return value === "en" ? "en" : "fr";
}

/**
 * Comparaison de signatures avec une durée
 * indépendante de leur contenu.
 */
function secureCompareHex(
  received: string,
  expected: string,
): boolean {
  if (
    !HEX_SHA256_PATTERN.test(received) ||
    !HEX_SHA256_PATTERN.test(expected)
  ) {
    return false;
  }

  const receivedBuffer = Buffer.from(
    received,
    "hex",
  );

  const expectedBuffer = Buffer.from(
    expected,
    "hex",
  );

  if (
    receivedBuffer.length !==
    expectedBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    receivedBuffer,
    expectedBuffer,
  );
}

/* ============================================================
   ANALYSE DU QR CODE
============================================================ */

type ParsedQr = {
  ticketId: string;
  tokenDigest: string;
};

/**
 * Vérification du format et de la signature.
 *
 * Format officiel :
 * tkm1.<ticketId>.<signature>
 *
 * La signature correspond exactement à
 * la génération des billets TIKEMIA.
 */
export function parseTicketQr(qrCode: string): ParsedQr | null { const payload = parseTicketQrToken(qrCode); if (!payload || !verifyTicketQrSignature(qrCode)) return null; return { ticketId: payload.ticketId, tokenDigest: sha256(qrCode) }; }

/* ============================================================
   CONSTRUCTION DES RÉSULTATS
============================================================ */

function makeResult(
  code: ScannerResultCode,
  locale: ScannerLanguage,
  scannedAt: Date,
  ticket: ScannerTicketInfo | null = null,
): ScannerResponse {
  const [message, description] =
    MESSAGES[locale][code];

  const allowed = code === "VALID";

  return {
    success: allowed,
    allowed,
    code,
    message,
    description,
    scannedAt: scannedAt.toISOString(),
    ticket,
  };
}

/**
 * Mapping vers l'enum ScanResult existant.
 *
 * Le schéma actuel ne possède pas de valeurs
 * spécifiques TRANSFERRED ou UNPAID.
 *
 * Nous conservons donc ces détails dans
 * la réponse API sans modifier Prisma.
 */
function toDatabaseScanResult(
  code: ScannerResultCode,
):
  | "VALID"
  | "ALREADY_USED"
  | "INVALID"
  | "WRONG_EVENT"
  | "CANCELLED"
  | "EXPIRED"
  | "BLOCKED"
  | "UNAUTHORIZED" {
  switch (code) {
    case "VALID":
      return "VALID";

    case "ALREADY_USED":
      return "ALREADY_USED";

    case "WRONG_EVENT":
      return "WRONG_EVENT";

    case "CANCELLED":
      return "CANCELLED";

    case "EXPIRED":
      return "EXPIRED";

    case "BLOCKED":
      return "BLOCKED";

    case "UNAUTHORIZED":
      return "UNAUTHORIZED";

    default:
      return "INVALID";
  }
}

/* ============================================================
   VALIDATION PRINCIPALE
============================================================ */

/**
 * Vérifie et consomme un billet.
 *
 * IMPORTANT :
 *
 * scannedById doit provenir de la session
 * authentifiée, jamais du JSON du navigateur.
 *
 * eventId doit correspondre à l'événement
 * sélectionné et autorisé pour cet agent.
 *
 * Cette fonction doit être appelée depuis :
 *
 * POST /api/organizer/scan/verify
 *
 * Chaque appel utilise la base en temps réel.
 */
export async function verifyAndScanTicket(
  input: ScannerInput,
): Promise<ScannerResponse> {
  const {
    eventId,
    scannedById,
    qrCode,
  } = input;

  const locale = getLanguage(input.locale);

  if (
    !isUuid(eventId) ||
    !isUuid(scannedById)
  ) {
    throw new ScannerError(
      "INVALID_SCAN_REQUEST",
      400,
    );
  }

  if (
    typeof qrCode !== "string" ||
    qrCode.length === 0 ||
    qrCode.length > MAX_QR_LENGTH
  ) {
    throw new ScannerError(
      "INVALID_QR_INPUT",
      400,
    );
  }

  const prisma = getPlatformPrisma();

  /**
   * Vérifier l'utilisateur connecté.
   */
  const user = await prisma.user.findUnique({
    where: {
      id: scannedById,
    },

    select: {
      id: true,
      isActive: true,
      isBlocked: true,
    },
  });

  if (
    !user ||
    !user.isActive ||
    user.isBlocked
  ) {
    throw new ScannerError(
      "SCANNER_ACCESS_DENIED",
      403,
    );
  }

  /**
   * Autorisations de l'événement :
   *
   * - Propriétaire de l'organisation
   * - Membre actif de l'organisation
   * - Agent de scan actif et non expiré
   */
  const event = await prisma.event.findUnique({
    where: {
      id: eventId,
    },

    select: {
      id: true,
      title: true,
      status: true,

      organization: {
        select: {
          ownerId: true,
          isActive: true,

          members: {
            where: {
              userId: scannedById,
              isActive: true,
            },

            select: {
              id: true,
            },

            take: 1,
          },
        },
      },

      scanAgents: {
        where: {
          userId: scannedById,
          isActive: true,

          OR: [
            {
              expiresAt: null,
            },
            {
              expiresAt: {
                gt: new Date(),
              },
            },
          ],
        },

        select: {
          id: true,
        },

        take: 1,
      },
    },
  });

  if (!event) {
    throw new ScannerError(
      "EVENT_NOT_FOUND",
      404,
    );
  }

  const isOwner =
    event.organization.ownerId === scannedById;

  const isMember =
    event.organization.members.length > 0;

  const isScanAgent =
    event.scanAgents.length > 0;

  if (
    !event.organization.isActive ||
    (!isOwner && !isMember && !isScanAgent)
  ) {
    throw new ScannerError(
      "SCANNER_ACCESS_DENIED",
      403,
    );
  }

  /**
   * Un événement suspendu, annulé ou archivé
   * ne doit pas accepter de nouvelles entrées.
   */
  if (event.status !== "PUBLISHED") {
    throw new ScannerError(
      "EVENT_NOT_AVAILABLE_FOR_SCAN",
      409,
    );
  }

  /**
   * Ne jamais conserver le QR brut
   * dans l'historique des scans.
   */
  const tokenDigest = sha256(qrCode);

  /**
   * La signature est vérifiée avant toute
   * recherche du billet en base.
   */
  const parsedQr = parseTicketQr(qrCode);

  /**
   * Toutes les tentatives de lecture
   * autorisées sont historisées.
   *
   * Les informations sensibles du QR
   * ne sont jamais enregistrées en clair.
   */
  return prisma.$transaction(async (tx) => {
    const scannedAt = new Date();

    /**
     * Enregistrer un rejet.
     */
    async function reject(
      code: ScannerResultCode,
      ticketId: string | null = null,
      ticketInfo: ScannerTicketInfo | null = null,
    ): Promise<ScannerResponse> {
      await tx.ticketScan.create({
        data: {
          eventId,
          scannedById,
          ticketId,

          tokenDigest,

          result: toDatabaseScanResult(code),

          scannedAt,
        },
      });

      return makeResult(
        code,
        locale,
        scannedAt,
        ticketInfo,
      );
    }

    /**
     * QR falsifié ou inconnu.
     */
    if (!parsedQr) {
      return reject("INVALID");
    }

    /**
     * Recherche directe par ID primaire.
     * Aucun chargement de tous les billets.
     */
    await tx.$queryRaw`SELECT "id" FROM "Ticket" WHERE "id" = ${parsedQr.ticketId}::uuid FOR UPDATE`;
    const ticket = await tx.ticket.findUnique({
      where: {
        id: parsedQr.ticketId,
      },

      select: {
        id: true,
        number: true,
        eventId: true,
        status: true,
        usedAt: true,
        guestEmail: true,
        qrTokenHash: true,

        orderLine: { select: { categoryName: true } },
        transfers: { where: { status: { in: ["PENDING", "ACCEPTED"] } }, take: 1, orderBy: { createdAt: "desc" }, select: { id: true, status: true } },
        category: {
          select: {
            name: true,
          },
        },

        owner: {
          select: {
            fullName: true,
            phoneE164: true,
          },
        },

        order: {
          select: {
            status: true,
            guestPhoneE164: true,
            total: true, currency: true,
            payments: { select: { status: true, paidAt: true, amount: true, currency: true } },
          },
        },
      },
    });

    if (!ticket) {
      return reject("INVALID");
    }

    /**
     * Contrôle du hash enregistré.
     *
     * Une signature correcte ne suffit pas :
     * le token doit correspondre au billet
     * actuellement enregistré.
     *
     * Cela permet notamment la révocation
     * d'un ancien token après transfert.
     */
    if (
      !secureCompareHex(
        tokenDigest,
        ticket.qrTokenHash,
      )
    ) {
      return reject("INVALID");
    }

    /**
     * Refuser les billets associés
     * à un événement différent.
     *
     * L'historique reste rattaché
     * à l'événement réellement scanné.
     */
    if (ticket.eventId !== eventId) {
      return reject("WRONG_EVENT");
    }

    /**
     * Information limitée affichable
     * dans le panneau du scanner.
     *
     * Le numéro de téléphone est utilisé
     * lorsqu'il est disponible.
     */
    const holder =
      ticket.owner?.phoneE164 ||
      (!ticket.transfers.length ? ticket.order.guestPhoneE164 : null) ||
      ticket.owner?.fullName ||
      null;

    const ticketInfo: ScannerTicketInfo = {
      id: ticket.id,
      number: ticket.number,
      eventId: ticket.eventId,
      eventTitle: event.title,
      category: ticket.orderLine.categoryName,
      holder,
      usedAt: ticket.usedAt
        ? ticket.usedAt.toISOString()
        : null,
    };

    /**
     * Le billet a déjà été utilisé.
     */
    if (
      ticket.status === "USED" ||
      ticket.usedAt !== null
    ) {
      return reject(
        "ALREADY_USED",
        ticket.id,
        ticketInfo,
      );
    }

    /**
     * Billet annulé ou remboursé.
     */
    if (
      ticket.status === "CANCELLED" ||
      ticket.status === "REFUNDED"
    ) {
      return reject(
        "CANCELLED",
        ticket.id,
        ticketInfo,
      );
    }

    /**
     * Billet expiré.
     */
    if (ticket.status === "EXPIRED") {
      return reject(
        "EXPIRED",
        ticket.id,
        ticketInfo,
      );
    }

    /**
     * Billet bloqué.
     */
    if (ticket.status === "BLOCKED") {
      return reject(
        "BLOCKED",
        ticket.id,
        ticketInfo,
      );
    }

    /**
     * Billet transféré.
     */
    if (ticket.status === "TRANSFERRED") {
      return reject(
        "TRANSFERRED",
        ticket.id,
        ticketInfo,
      );
    }

    /**
     * Transfert en attente.
     */
    if (ticket.status === "TRANSFER_PENDING") {
      return reject(
        "TRANSFER_PENDING",
        ticket.id,
        ticketInfo,
      );
    }

    /**
     * Refuser tout état inconnu.
     */
    if (ticket.status !== "VALID") {
      return reject(
        "INVALID",
        ticket.id,
        ticketInfo,
      );
    }

    /**
     * Vérification de la commande payée.
     *
     * Une commande partiellement remboursée
     * peut contenir des billets encore valides.
     * Leur propre statut reste déterminant.
     */
    if (ticket.transfers.some(transfer => transfer.status === "PENDING")) return reject("TRANSFER_PENDING", ticket.id, ticketInfo);
    const orderIsPaid = (ticket.order.status === "PAID" || ticket.order.status === "PARTIALLY_REFUNDED") && ticket.order.payments.some(payment => payment.status === "SUCCEEDED" && payment.paidAt && payment.amount === ticket.order.total && payment.currency === ticket.order.currency);

    if (!orderIsPaid) {
      return reject(
        "UNPAID",
        ticket.id,
        ticketInfo,
      );
    }

    /* ========================================================
       VALIDATION ATOMIQUE
    ======================================================== */

    /**
     * OPÉRATION CRITIQUE
     *
     * UPDATE conditionnel :
     *
     * - ID du billet exact
     * - événement exact
     * - état VALID
     * - usedAt encore NULL
     *
     * PostgreSQL protège cette mise à jour
     * contre deux validations concurrentes.
     *
     * Si deux téléphones scannent au même
     * moment, un seul UPDATE peut réussir.
     */
    const updated = await tx.ticket.updateMany({
      where: {
        id: ticket.id,
        qrTokenHash: tokenDigest,
        eventId,
        status: "VALID",
        usedAt: null,
      },

      data: {
        status: "USED",
        usedAt: scannedAt,
      },
    });

    /**
     * Si aucun billet n'a été modifié,
     * il a potentiellement déjà été validé
     * par un autre agent.
     */
    if (updated.count !== 1) {
      const currentTicket =
        await tx.ticket.findUnique({
          where: {
            id: ticket.id,
          },

          select: {
            status: true,
            usedAt: true,
          },
        });

      let rejection: ScannerResultCode = "INVALID";

      if (
        currentTicket?.status === "USED" ||
        currentTicket?.usedAt !== null &&
        currentTicket?.usedAt !== undefined
      ) {
        rejection = "ALREADY_USED";
      } else if (
        currentTicket?.status === "CANCELLED" ||
        currentTicket?.status === "REFUNDED"
      ) {
        rejection = "CANCELLED";
      } else if (
        currentTicket?.status === "EXPIRED"
      ) {
        rejection = "EXPIRED";
      } else if (
        currentTicket?.status === "BLOCKED"
      ) {
        rejection = "BLOCKED";
      } else if (
        currentTicket?.status === "TRANSFERRED"
      ) {
        rejection = "TRANSFERRED";
      } else if (
        currentTicket?.status === "TRANSFER_PENDING"
      ) {
        rejection = "TRANSFER_PENDING";
      }

      return reject(
        rejection,
        ticket.id,
        ticketInfo,
      );
    }

    /**
     * Historique de validation.
     *
     * L'écriture du billet et l'historique
     * sont dans la même transaction.
     *
     * Si la création de l'historique échoue,
     * PostgreSQL annule également la
     * validation du billet.
     */
    await tx.ticketScan.create({
      data: {
        ticketId: ticket.id,
        eventId,
        scannedById,

        result: "VALID",

        tokenDigest: parsedQr.tokenDigest,

        scannedAt,
      },
    });

    /**
     * Validation confirmée.
     *
     * Ce résultat n'est renvoyé qu'après
     * la réussite de la transaction.
     */
    return makeResult(
      "VALID",
      locale,
      scannedAt,
      {
        ...ticketInfo,
        usedAt: scannedAt.toISOString(),
      },
    );
  });
}
