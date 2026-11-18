
import "server-only";

import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";

import QRCode from "qrcode";

import {
  getPlatformPrisma,
} from "@/lib/payments/fulfillment";

/**
 * ============================================================
 * TIKEMIA — SYSTÈME QR DES BILLETS
 * ============================================================
 *
 * Fichier :
 * src/lib/tickets/qr.ts
 *
 * Responsabilités :
 *
 * 1. Générer un QR sécurisé par billet.
 * 2. Signer le QR avec un secret serveur.
 * 3. Produire son hash SHA-256.
 * 4. Générer l'image QR pour le PDF.
 * 5. Vérifier la signature du QR.
 * 6. Vérifier l'existence du billet en base.
 * 7. Vérifier la correspondance avec l'événement.
 * 8. Vérifier que la commande est payée.
 * 9. Vérifier le statut réel du billet.
 * 10. Empêcher de présenter un billet utilisé
 *     comme billet encore valide.
 *
 * Le contrôle est effectué côté serveur.
 *
 * L'email, le téléphone et les données
 * personnelles ne sont jamais encodés
 * directement dans le QR.
 *
 * Le scan définitif avec consommation
 * atomique sera effectué par l'API
 * de contrôle d'accès.
 * ============================================================
 */

/* ============================================================
   CONFIGURATION
============================================================ */

const QR_VERSION = "tkm1";

const QR_CONTEXT =
  "tikemia:ticket:qr:v1";

const QR_SEPARATOR = ".";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SIGNATURE_PATTERN =
  /^[a-f0-9]{64}$/i;

const SHA256_PATTERN =
  /^[a-f0-9]{64}$/i;

const QR_MAX_LENGTH = 192;

const QR_IMAGE_WIDTH = 900;

const QR_IMAGE_MARGIN = 4;

const QR_IMAGE_ERROR_CORRECTION = "H" as const;

/* ============================================================
   TYPES PUBLICS
============================================================ */

export type TicketQrVerificationStatus =
  | "VALID"
  | "INVALID"
  | "ALREADY_USED"
  | "WRONG_EVENT"
  | "CANCELLED"
  | "REFUNDED"
  | "EXPIRED"
  | "BLOCKED"
  | "TRANSFER_PENDING";

export type TicketQrVerificationResult = {
  valid: boolean;

  status: TicketQrVerificationStatus;

  ticketId: string | null;

  ticketNumber: string | null;

  eventId: string | null;

  usedAt: string | null;
};

export type TicketQrImageOptions = {
  width?: number;

  margin?: number;

  darkColor?: string;

  lightColor?: string;
};

export type GeneratedTicketQr = {
  ticketId: string;

  token: string;

  tokenHash: string;

  imageDataUrl: string;
};

export type TicketQrPayload = {
  version: typeof QR_VERSION | "tkm2";
  transferId?: string;

  ticketId: string;

  signature: string;
};

/* ============================================================
   ERREURS
============================================================ */

export class TicketQrError extends Error {
  constructor(
    public readonly code: string
  ) {
    super(code);

    this.name = "TicketQrError";
  }
}

/* ============================================================
   VALIDATION UUID
============================================================ */

function isValidUuid(
  value: unknown
): value is string {
  return (
    typeof value === "string" &&
    UUID_PATTERN.test(value)
  );
}

function normalizeTicketId(
  ticketId: string
): string {
  if (!isValidUuid(ticketId)) {
    throw new TicketQrError(
      "INVALID_TICKET_ID"
    );
  }

  return ticketId.toLowerCase();
}

/* ============================================================
   SECRET SERVEUR
============================================================ */

/**
 * Variable .env :
 *
 * TIKEMIA_TICKET_QR_SECRET=
 *
 * Minimum : 32 octets.
 *
 * Le secret doit être :
 *
 * - Aléatoire
 * - Privé
 * - Stable
 * - Identique sur toutes les instances
 *   serveur de la même plateforme
 *
 * Ne jamais l'exposer au navigateur.
 */

function getQrSecret(): string {
  const secret =
    process.env.TIKEMIA_TICKET_QR_SECRET;

  if (
    !secret ||
    Buffer.byteLength(
      secret,
      "utf8"
    ) < 32
  ) {
    throw new TicketQrError(
      "QR_SECRET_NOT_CONFIGURED"
    );
  }

  return secret;
}

/* ============================================================
   SIGNATURE HMAC SHA-256
============================================================ */

/**
 * La signature associe :
 *
 * - La version du protocole QR
 * - L'identifiant du billet
 * - Le secret du serveur
 *
 * Elle empêche la création d'un QR valide
 * sans posséder le secret TIKEMIA.
 *
 * Cette formule est compatible avec
 * createTicketQrToken() précédemment
 * défini dans fulfillment.ts.
 */

function signTicketId(
  ticketId: string, transferId?: string
): string {
  const id =
    normalizeTicketId(ticketId);

  const hmac = createHmac(
    "sha256",
    getQrSecret()
  )
    .update(QR_CONTEXT)
    .update("\0")
    .update(id);
  if (transferId) hmac.update("\0").update(normalizeTicketId(transferId));
  return hmac.digest("hex");
}

/* ============================================================
   COMPARAISON CRYPTOGRAPHIQUE
============================================================ */

function secureHexCompare(
  supplied: string,
  expected: string
): boolean {
  if (
    !SIGNATURE_PATTERN.test(supplied) ||
    !SIGNATURE_PATTERN.test(expected)
  ) {
    return false;
  }

  const first = Buffer.from(
    supplied,
    "hex"
  );

  const second = Buffer.from(
    expected,
    "hex"
  );

  if (
    first.length !== second.length
  ) {
    return false;
  }

  return timingSafeEqual(
    first,
    second
  );
}

/* ============================================================
   GÉNÉRATION DU TOKEN QR
============================================================ */

/**
 * Format :
 *
 * tkm1.<ticketId>.<signature>
 *
 * Exemple :
 *
 * tkm1.uuid.signature_hmac_sha256
 *
 * Chaque billet reçoit son propre token.
 *
 * Quatre billets distincts possèdent
 * quatre identifiants et quatre QR
 * différents.
 *
 * Le token ne contient ni :
 *
 * - Email
 * - Téléphone
 * - Nom du titulaire
 * - Montant payé
 * - Données bancaires
 */

export function createTicketQrToken(
  ticketId: string, transferId?: string
): string {
  const normalizedId =
    normalizeTicketId(ticketId);

  const signature =
    signTicketId(normalizedId, transferId);

  return transferId ? ["tkm2", normalizedId, normalizeTicketId(transferId), signature].join(QR_SEPARATOR) : [QR_VERSION, normalizedId, signature].join(QR_SEPARATOR);
}

/* ============================================================
   HASH SHA-256 DU TOKEN
============================================================ */

/**
 * La base de données Ticket possède :
 *
 * qrTokenHash String @unique
 *
 * On y stocke uniquement le hash.
 *
 * Cela permet de comparer le QR
 * présenté avec celui émis par TIKEMIA.
 */

export function hashTicketQrToken(
  token: string
): string {
  if (
    typeof token !== "string" ||
    token.length < 1 ||
    token.length > QR_MAX_LENGTH
  ) {
    throw new TicketQrError(
      "INVALID_QR_TOKEN"
    );
  }

  return createHash("sha256")
    .update(token, "utf8")
    .digest("hex");
}

/* ============================================================
   EXTRACTION DU TOKEN
============================================================ */

/**
 * Analyse le contenu du QR.
 *
 * Cette fonction valide uniquement
 * la structure syntaxique.
 *
 * La signature sera vérifiée ensuite.
 */

export function parseTicketQrToken(
  token: string
): TicketQrPayload | null {
  if (
    typeof token !== "string" ||
    token.length > QR_MAX_LENGTH
  ) {
    return null;
  }

  const parts =
    token.split(QR_SEPARATOR);

  if (parts.length !== 3 && parts.length !== 4) {
    return null;
  }

  const version = parts[0], ticketId = parts[1], transferId = parts.length === 4 ? parts[2] : undefined, signature = parts[parts.length - 1];
  if ((parts.length === 3 && version !== QR_VERSION) || (parts.length === 4 && (version !== "tkm2" || !isValidUuid(transferId) || transferId !== transferId.toLowerCase()))) return null;
  if (!isValidUuid(ticketId)) {
    return null;
  }

  if (
    !SIGNATURE_PATTERN.test(signature)
  ) {
    return null;
  }

  // Refuser une représentation non canonique.
  if (
    ticketId !== ticketId.toLowerCase() ||
    signature !== signature.toLowerCase()
  ) {
    return null;
  }

  return {
    version: version as typeof QR_VERSION | "tkm2",
    ticketId,
    transferId,
    signature,
  };
}

/* ============================================================
   VÉRIFICATION CRYPTOGRAPHIQUE
============================================================ */

/**
 * Vérifie que le token :
 *
 * - Respecte le format TIKEMIA
 * - Contient un UUID valide
 * - Possède une signature authentique
 *
 * Cette opération ne consulte pas
 * encore PostgreSQL.
 *
 * Elle ne suffit donc pas à autoriser
 * l'entrée à un événement.
 */

export function verifyTicketQrSignature(
  token: string, transferId?: string
): TicketQrPayload | null {
  const payload =
    parseTicketQrToken(token);

  if (!payload) {
    return null;
  }

  if (transferId && payload.transferId !== transferId) return null;
  const expectedSignature = signTicketId(payload.ticketId, transferId ?? payload.transferId);

  if (
    !secureHexCompare(
      payload.signature,
      expectedSignature
    )
  ) {
    return null;
  }

  return payload;
}

/* ============================================================
   CONTRÔLE DU HASH ENREGISTRÉ
============================================================ */

function verifyStoredTokenHash(
  suppliedToken: string,
  storedHash: string
): boolean {
  if (
    typeof storedHash !== "string" ||
    !SHA256_PATTERN.test(storedHash)
  ) {
    return false;
  }

  const suppliedHash =
    hashTicketQrToken(
      suppliedToken
    );

  return secureHexCompare(
    suppliedHash,
    storedHash
  );
}

/* ============================================================
   GÉNÉRATION DE L'IMAGE QR
============================================================ */

/**
 * Produit une image PNG encodée en Data URL.
 *
 * Utilisation :
 * - PDF billet
 * - Email HTML
 * - Espace personnel
 *
 * Le QR utilise une correction d'erreur
 * élevée pour améliorer la lecture.
 *
 * Le fond reste blanc et les modules
 * sont noirs pour préserver la lisibilité.
 *
 * Les éléments verts décoratifs du billet
 * seront ajoutés par pdf.ts en dehors
 * de la zone de lecture QR.
 */

export async function generateTicketQrDataUrl(
  token: string,
  options: TicketQrImageOptions = {}
): Promise<string> {
  const payload =
    verifyTicketQrSignature(
      token
    );

  if (!payload) {
    throw new TicketQrError(
      "INVALID_QR_SIGNATURE"
    );
  }

  const width =
    options.width ??
    QR_IMAGE_WIDTH;

  const margin =
    options.margin ??
    QR_IMAGE_MARGIN;

  if (
    !Number.isInteger(width) ||
    width < 256 ||
    width > 2048
  ) {
    throw new TicketQrError(
      "INVALID_QR_WIDTH"
    );
  }

  if (
    !Number.isInteger(margin) ||
    margin < 4 ||
    margin > 12
  ) {
    throw new TicketQrError(
      "INVALID_QR_MARGIN"
    );
  }

  return QRCode.toDataURL(
    token,
    {
      type: "image/png",

      width,

      margin,

      errorCorrectionLevel:
        QR_IMAGE_ERROR_CORRECTION,

      color: {
        dark:
          options.darkColor ??
          "#000000",

        light:
          options.lightColor ??
          "#FFFFFF",
      },
    }
  );
}

/* ============================================================
   GÉNÉRATION DU QR AU FORMAT PNG
============================================================ */

/**
 * Retourne directement les octets PNG.
 *
 * C'est le format recommandé pour
 * le générateur de billets PDF.
 *
 * Aucun fichier temporaire n'est créé.
 */

export async function generateTicketQrPng(
  token: string,
  options: TicketQrImageOptions = {}
): Promise<Buffer> {
  const payload =
    verifyTicketQrSignature(token);

  if (!payload) {
    throw new TicketQrError(
      "INVALID_QR_SIGNATURE"
    );
  }

  const width =
    options.width ??
    QR_IMAGE_WIDTH;

  const margin =
    options.margin ??
    QR_IMAGE_MARGIN;

  if (
    !Number.isInteger(width) ||
    width < 256 ||
    width > 2048 ||
    !Number.isInteger(margin) ||
    margin < 4 ||
    margin > 12
  ) {
    throw new TicketQrError(
      "INVALID_QR_OPTIONS"
    );
  }

  return QRCode.toBuffer(
    token,
    {
      type: "png",

      width,

      margin,

      errorCorrectionLevel:
        QR_IMAGE_ERROR_CORRECTION,

      color: {
        dark:
          options.darkColor ??
          "#000000",

        light:
          options.lightColor ??
          "#FFFFFF",
      },
    }
  );
}

/* ============================================================
   GÉNÉRER LE QR COMPLET
============================================================ */

/**
 * Génère :
 *
 * - Le token QR
 * - Son hash
 * - Son image PNG en Data URL
 *
 * À utiliser uniquement côté serveur.
 *
 * Le hash doit être enregistré dans
 * Ticket.qrTokenHash.
 */

export async function generateTicketQr(
  ticketId: string
): Promise<GeneratedTicketQr> {
  const normalizedId =
    normalizeTicketId(ticketId);

  const token =
    createTicketQrToken(
      normalizedId
    );

  const tokenHash =
    hashTicketQrToken(
      token
    );

  const imageDataUrl =
    await generateTicketQrDataUrl(
      token
    );

  return {
    ticketId:
      normalizedId,

    token,

    tokenHash,

    imageDataUrl,
  };
}

/* ============================================================
   RÉSULTAT DE VÉRIFICATION
============================================================ */

function invalidResult(
  status: TicketQrVerificationStatus =
    "INVALID"
): TicketQrVerificationResult {
  return {
    valid: false,

    status,

    ticketId: null,

    ticketNumber: null,

    eventId: null,

    usedAt: null,
  };
}

/* ============================================================
   VÉRIFIER UN BILLET EN BASE DE DONNÉES
============================================================ */

/**
 * Vérification complète :
 *
 * 1. Signature HMAC correcte.
 * 2. Billet existant dans PostgreSQL.
 * 3. Hash QR correspondant.
 * 4. Commande réellement payée.
 * 5. Événement correspondant.
 * 6. Billet non annulé.
 * 7. Billet non remboursé.
 * 8. Billet non bloqué.
 * 9. Billet non utilisé.
 *
 * Cette fonction est une lecture de contrôle.
 *
 * Elle ne consomme PAS le billet.
 *
 * L'API de scan devra effectuer une mise
 * à jour atomique :
 *
 * VALID -> USED
 *
 * Avec un contrôle des droits de l'agent
 * et un enregistrement TicketScan.
 */

export async function verifyTicketQr(
  token: string,
  expectedEventId?: string
): Promise<TicketQrVerificationResult> {
  /* --------------------------------------------------------
     SIGNATURE
  -------------------------------------------------------- */

  const payload =
    parseTicketQrToken(token);

  if (!payload) {
    return invalidResult();
  }

  /* --------------------------------------------------------
     ÉVÉNEMENT ATTENDU
  -------------------------------------------------------- */

  if (
    expectedEventId !== undefined &&
    !isValidUuid(expectedEventId)
  ) {
    return invalidResult();
  }

  /* --------------------------------------------------------
     POSTGRESQL
  -------------------------------------------------------- */

  const prisma =
    getPlatformPrisma();

  const ticket =
    await prisma.ticket.findUnique({
      where: {
        id:
          payload.ticketId,
      },

      select: {
        id: true,

        number: true,

        eventId: true,

        status: true,

        transfers: { where: { status: "ACCEPTED" }, orderBy: [{ acceptedAt: "desc" }, { id: "desc" }], take: 1, select: { id: true } },
        qrTokenHash: true,

        usedAt: true,

        order: {
          select: {
            status: true,

            paidAt: true,
          },
        },
      },
    });

  /* --------------------------------------------------------
     BILLET INEXISTANT
  -------------------------------------------------------- */

  if (!ticket) {
    return invalidResult();
  }

  /* --------------------------------------------------------
     HASH DU QR
  -------------------------------------------------------- */

  if (
    !verifyTicketQrSignature(token, ticket.transfers[0]?.id) ||
    !verifyStoredTokenHash(
      token,
      ticket.qrTokenHash
    )
  ) {
    return invalidResult();
  }

  /* --------------------------------------------------------
     ÉVÉNEMENT
  -------------------------------------------------------- */

  if (
    expectedEventId &&
    ticket.eventId.toLowerCase() !==
      expectedEventId.toLowerCase()
  ) {
    return {
      valid: false,

      status:
        "WRONG_EVENT",

      ticketId:
        ticket.id,

      ticketNumber:
        ticket.number,

      eventId:
        ticket.eventId,

      usedAt:
        ticket.usedAt
          ?.toISOString() ?? null,
    };
  }

  /* --------------------------------------------------------
     COMMANDE PAYÉE
  -------------------------------------------------------- */

  if (
    ticket.order.status !== "PAID" ||
    ticket.order.paidAt === null
  ) {
    return invalidResult();
  }

  /* --------------------------------------------------------
     STATUTS DES BILLETS
  -------------------------------------------------------- */

  const resultBase = {
    ticketId:
      ticket.id,

    ticketNumber:
      ticket.number,

    eventId:
      ticket.eventId,

    usedAt:
      ticket.usedAt
        ?.toISOString() ?? null,
  };

  if (
    ticket.status === "USED" ||
    ticket.usedAt !== null
  ) {
    return {
      valid: false,

      status:
        "ALREADY_USED",

      ...resultBase,
    };
  }

  if (
    ticket.status === "CANCELLED"
  ) {
    return {
      valid: false,

      status:
        "CANCELLED",

      ...resultBase,
    };
  }

  if (
    ticket.status === "REFUNDED"
  ) {
    return {
      valid: false,

      status:
        "REFUNDED",

      ...resultBase,
    };
  }

  if (
    ticket.status === "EXPIRED"
  ) {
    return {
      valid: false,

      status:
        "EXPIRED",

      ...resultBase,
    };
  }

  if (
    ticket.status === "BLOCKED"
  ) {
    return {
      valid: false,

      status:
        "BLOCKED",

      ...resultBase,
    };
  }

  if (
    ticket.status === "TRANSFER_PENDING" ||
    ticket.status === "TRANSFERRED"
  ) {
    return {
      valid: false,

      status:
        "TRANSFER_PENDING",

      ...resultBase,
    };
  }

  /* --------------------------------------------------------
     BILLET VALIDE
  -------------------------------------------------------- */

  if (
    ticket.status === "VALID"
  ) {
    return {
      valid: true,

      status: "VALID",

      ...resultBase,
    };
  }

  return invalidResult();
}

/* ============================================================
   RÉGÉNÉRATION DU QR D'UN BILLET EXISTANT
============================================================ */

/**
 * Utilisé par :
 *
 * - pdf.ts
 * - Le service email
 * - L'espace personnel
 *
 * Le billet doit :
 *
 * - Exister
 * - Être associé à une commande payée
 * - Posséder le hash attendu
 * - Ne pas être annulé ou remboursé
 *
 * La régénération ne modifie pas le QR.
 * Le même billet conserve son même QR.
 */

export async function regenerateTicketQr(
  ticketId: string
): Promise<GeneratedTicketQr> {
  const normalizedId =
    normalizeTicketId(ticketId);

  const prisma =
    getPlatformPrisma();

  const ticket =
    await prisma.ticket.findUnique({
      where: {
        id: normalizedId,
      },

      select: {
        id: true,

        transfers: { where: { status: "ACCEPTED" }, orderBy: [{ acceptedAt: "desc" }, { id: "desc" }], take: 1, select: { id: true } },
        qrTokenHash: true,

        status: true,

        order: {
          select: {
            status: true,
            paidAt: true,
          },
        },
      },
    });

  if (!ticket) {
    throw new TicketQrError(
      "TICKET_NOT_FOUND"
    );
  }

  if (
    ticket.order.status !== "PAID" ||
    !ticket.order.paidAt
  ) {
    throw new TicketQrError(
      "ORDER_NOT_PAID"
    );
  }

  if (
    ticket.status === "CANCELLED" ||
    ticket.status === "REFUNDED" ||
    ticket.status === "BLOCKED"
  ) {
    throw new TicketQrError(
      "TICKET_NOT_AVAILABLE"
    );
  }

  const token =
    createTicketQrToken(
      ticket.id, ticket.transfers[0]?.id
    );

  const tokenHash =
    hashTicketQrToken(
      token
    );

  if (
    !secureHexCompare(
      tokenHash,
      ticket.qrTokenHash
    )
  ) {
    const revision = ticket.transfers[0]?.id;
    const legacySecret = process.env.TIKEMIA_OTP_SECRET;
    const legacyToken = revision && legacySecret ? createHmac("sha256", legacySecret).update("tikemia:ticket-qr:transfer:v1").update("\0").update(ticket.id).update("\0").update(revision).digest("hex") : null;
    const previousSignedToken = revision ? [QR_VERSION, ticket.id, signTicketId(ticket.id, revision)].join(QR_SEPARATOR) : null;
    if ((!legacyToken || !secureHexCompare(hashTicketQrToken(legacyToken), ticket.qrTokenHash)) && (!previousSignedToken || !secureHexCompare(hashTicketQrToken(previousSignedToken), ticket.qrTokenHash))) throw new TicketQrError("QR_TOKEN_MISMATCH");
    const repaired = await prisma.ticket.updateMany({ where: { id: ticket.id, qrTokenHash: ticket.qrTokenHash }, data: { qrTokenHash: tokenHash, pdfStorageKey: null } });
    if (repaired.count !== 1) throw new TicketQrError("QR_TOKEN_MISMATCH");
  }

  const imageDataUrl =
    await generateTicketQrDataUrl(
      token
    );

  return {
    ticketId:
      ticket.id,

    token,

    tokenHash,

    imageDataUrl,
  };
}
