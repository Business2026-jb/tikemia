
import "server-only";

import { createHash, createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { getPlatformPrisma } from "@/lib/payments/fulfillment";

import {
  buildTicketPurchaseEmail,
  buildDonationConfirmationEmail,
  type RenderedEmail,
  type TicketPurchaseEmailData,
  type DonationConfirmationEmailData,
} from "@/lib/email/templates";

import type {
  GeneratedTicketPdf,
} from "@/lib/tickets/pdf";

/**
 * ============================================================
 * TIKEMIA — SERVICE D'ENVOI DES EMAILS
 * ============================================================
 *
 * Fichier :
 * src/lib/email/send.ts
 *
 * Fournisseur : Resend API
 *
 * Fonctionnalités :
 *
 * - Envoi d'emails transactionnels
 * - HTML responsive et texte brut
 * - Français et anglais
 * - Billets PDF en pièces jointes
 * - Confirmation des dons
 * - Validation des destinataires
 * - Validation des fichiers PDF
 * - Protection contre les envois répétés
 * - Délais maximum de requête
 * - Gestion des erreurs du fournisseur
 * - Identifiant réel de l'email envoyé
 *
 * Sécurité :
 *
 * - Exécution serveur uniquement
 * - Clé API jamais transmise au navigateur
 * - Aucun envoi depuis un formulaire public
 * - Aucun email envoyé sans données validées
 * - Aucun statut de livraison inventé
 *
 * L'email doit être demandé par le worker
 * après confirmation officielle du paiement.
 *
 * Ce module ne change aucun statut Prisma.
 * ============================================================
 */

/* ============================================================
   CONFIGURATION
============================================================ */

const RESEND_ENDPOINT =
  "https://api.resend.com/emails";

const REQUEST_TIMEOUT_MS = 45000;

const MAX_ATTACHMENTS = 100;

const MAX_ATTACHMENT_BYTES =
  10 * 1024 * 1024;

const MAX_TOTAL_ATTACHMENT_BYTES =
  20 * 1024 * 1024;

const MAX_HTML_LENGTH = 500000;

const MAX_TEXT_LENGTH = 250000;

const MAX_SUBJECT_LENGTH = 250;

const MAX_IDEMPOTENCY_LENGTH = 256;

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PDF_HEADER =
  Buffer.from("%PDF-", "ascii");

/* ============================================================
   TYPES PUBLICS
============================================================ */

export type EmailAttachment = {
  filename: string;

  content: Buffer | Uint8Array;

  contentType: "application/pdf";
};

export type SendEmailInput = {
  /**
   * Destinataire réel.
   */
  to: string;

  /**
   * Sujet du message.
   */
  subject: string;

  /**
   * Contenu HTML.
   */
  html: string;

  /**
   * Version texte.
   */
  text: string;

  /**
   * Fichiers joints.
   */
  attachments?: readonly EmailAttachment[];

  /**
   * Identifiant stable d'une tâche.
   *
   * Le worker doit réutiliser exactement
   * la même clé lors d'une reprise.
   *
   * Ne pas générer une nouvelle clé
   * à chaque tentative.
   */
  idempotencyKey: string;

  /**
   * Adresse de réponse facultative.
   */
  replyTo?: string;
};

export type SendEmailResult = {
  accepted: true;

  provider: "resend";

  providerMessageId: string;

  recipient: string;

  attachmentCount: number;

  /**
   * Accepté par Resend, pas forcément
   * livré dans la boîte du destinataire.
   */
  status: "accepted";
};

export type TicketEmailSendInput = {
  data: TicketPurchaseEmailData;

  /**
   * Billets PDF déjà générés à partir
   * de la commande payée.
   */
  pdfs: readonly GeneratedTicketPdf[];

  /**
   * Clé stable fournie par le worker.
   */
  idempotencyKey: string;
};

export type DonationEmailSendInput = {
  data: DonationConfirmationEmailData;

  idempotencyKey: string;
};

/* ============================================================
   ERREURS
============================================================ */

export type EmailErrorCode =
  | "EMAIL_CONFIG_MISSING"
  | "INVALID_RECIPIENT"
  | "INVALID_SENDER"
  | "INVALID_REPLY_TO"
  | "INVALID_MESSAGE"
  | "INVALID_ATTACHMENT"
  | "ATTACHMENT_LIMIT_EXCEEDED"
  | "INVALID_IDEMPOTENCY_KEY"
  | "EMAIL_PROVIDER_REJECTED"
  | "EMAIL_RATE_LIMITED"
  | "EMAIL_PROVIDER_UNAVAILABLE"
  | "EMAIL_REQUEST_TIMEOUT"
  | "EMAIL_RESPONSE_INVALID"
  | "TICKET_PDF_MISMATCH";

export class EmailSendError extends Error {
  constructor(
    public readonly code: EmailErrorCode,
    public readonly retryable: boolean,
    public readonly httpStatus: number | null = null,
    public readonly outcomeUnknown = false
  ) {
    super(code);

    this.name = "EmailSendError";
  }
}

/* ============================================================
   VALIDATION GÉNÉRALE
============================================================ */

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function validEmail(
  value: unknown
): value is string {
  if (
    typeof value !== "string" ||
    value.length > 254
  ) {
    return false;
  }

  return EMAIL_PATTERN.test(
    value.trim()
  );
}

function normalizeEmail(
  value: unknown
): string {
  if (!validEmail(value)) {
    throw new EmailSendError(
      "INVALID_RECIPIENT",
      false
    );
  }

  return value.trim().toLowerCase();
}

function validSubject(
  value: unknown
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= MAX_SUBJECT_LENGTH &&
    !/[\r\n\x00-\x1F\x7F]/.test(value)
  );
}

/* ============================================================
   CONFIGURATION RESEND
============================================================ */

/**
 * Variables obligatoires :
 *
 * RESEND_API_KEY
 * TIKEMIA_EMAIL_FROM
 *
 * Exemple :
 *
 * TIKEMIA_EMAIL_FROM=
 * "TIKEMIA <billets@tikemia.com>"
 *
 * Le domaine doit être vérifié chez Resend.
 */

function getEmailConfiguration(): {
  apiKey: string;
  from: string;
  replyTo: string | null;
} {
  const apiKey =
    process.env.RESEND_API_KEY?.trim();

  const from =
    process.env.TIKEMIA_EMAIL_FROM?.trim();

  const replyTo =
    process.env.TIKEMIA_EMAIL_REPLY_TO?.trim() ??
    null;

  if (!apiKey) {
    throw new EmailSendError(
      "EMAIL_CONFIG_MISSING",
      false
    );
  }

  if (!from) {
    throw new EmailSendError(
      "INVALID_SENDER",
      false
    );
  }

  /*
   * Format accepté :
   *
   * billets@tikemia.com
   *
   * ou
   *
   * TIKEMIA <billets@tikemia.com>
   */

  const fromMatch =
    from.match(
      /^(?:[^<>\r\n]{1,100}\s*<)?([^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)>?$/
    );

  if (
    !fromMatch ||
    !validEmail(fromMatch[1])
  ) {
    throw new EmailSendError(
      "INVALID_SENDER",
      false
    );
  }

  if (
    replyTo &&
    !validEmail(replyTo)
  ) {
    throw new EmailSendError(
      "INVALID_REPLY_TO",
      false
    );
  }

  return {
    apiKey,
    from,
    replyTo:
      replyTo || null,
  };
}

/* ============================================================
   CLÉ D'IDEMPOTENCE
============================================================ */

/**
 * Une même tâche EmailDelivery.id
 * doit produire la même clé.
 *
 * Cela aide à éviter plusieurs emails
 * lorsqu'un worker retente l'envoi
 * après un timeout ou un incident réseau.
 */

export function makeEmailIdempotencyKey(
  deliveryId: string,
  template: string
): string {
  if (
    !UUID_PATTERN.test(deliveryId) ||
    !/^[a-z][a-z0-9_]{0,79}$/.test(template)
  ) {
    throw new EmailSendError(
      "INVALID_IDEMPOTENCY_KEY",
      false
    );
  }

  const digest =
    createHash("sha256")
      .update("tikemia:email:v1")
      .update("\0")
      .update(deliveryId.toLowerCase())
      .update("\0")
      .update(template)
      .digest("hex");

  return `tikemia-email-${digest}`;
}

function validateIdempotencyKey(
  value: string
): void {
  if (
    typeof value !== "string" ||
    value.length < 16 ||
    value.length > MAX_IDEMPOTENCY_LENGTH ||
    !/^[a-zA-Z0-9_.:-]+$/.test(value)
  ) {
    throw new EmailSendError(
      "INVALID_IDEMPOTENCY_KEY",
      false
    );
  }
}

/* ============================================================
   VALIDATION DU PDF
============================================================ */

/**
 * Les PDF doivent provenir du générateur
 * sécurisé de billets TIKEMIA.
 *
 * Cette validation vérifie :
 *
 * - La présence d'un fichier
 * - L'en-tête PDF
 * - Sa taille
 * - Son extension
 * - Son nom
 *
 * Elle ne remplace pas la vérification
 * du paiement et des billets en base.
 */

function validatePdfAttachment(
  attachment: EmailAttachment
): Buffer {
  if (
    !attachment ||
    typeof attachment.filename !== "string" ||
    attachment.filename.length < 5 ||
    attachment.filename.length > 180 ||
    !/^[a-zA-Z0-9_.-]+\.pdf$/i.test(
      attachment.filename
    ) ||
    attachment.contentType !==
      "application/pdf"
  ) {
    throw new EmailSendError(
      "INVALID_ATTACHMENT",
      false
    );
  }

  if (
    !Buffer.isBuffer(attachment.content) &&
    !(attachment.content instanceof Uint8Array)
  ) {
    throw new EmailSendError(
      "INVALID_ATTACHMENT",
      false
    );
  }

  const bytes =
    Buffer.from(attachment.content);

  if (
    bytes.length < PDF_HEADER.length ||
    bytes.length > MAX_ATTACHMENT_BYTES ||
    !bytes.subarray(
      0,
      PDF_HEADER.length
    ).equals(PDF_HEADER)
  ) {
    throw new EmailSendError(
      "INVALID_ATTACHMENT",
      false
    );
  }

  return bytes;
}

/* ============================================================
   PRÉPARER LES PIÈCES JOINTES
============================================================ */

type ResendAttachment = {
  filename: string;
  content: string;
  content_type: "application/pdf";
};

function prepareAttachments(
  attachments: readonly EmailAttachment[]
): ResendAttachment[] {
  if (
    attachments.length >
    MAX_ATTACHMENTS
  ) {
    throw new EmailSendError(
      "ATTACHMENT_LIMIT_EXCEEDED",
      false
    );
  }

  let totalBytes = 0;

  const names =
    new Set<string>();

  const prepared:
    ResendAttachment[] = [];

  for (const attachment of attachments) {
    const bytes =
      validatePdfAttachment(
        attachment
      );

    totalBytes += bytes.length;

    if (
      totalBytes >
      MAX_TOTAL_ATTACHMENT_BYTES
    ) {
      throw new EmailSendError(
        "ATTACHMENT_LIMIT_EXCEEDED",
        false
      );
    }

    const filename =
      attachment.filename;

    if (names.has(filename)) {
      throw new EmailSendError(
        "INVALID_ATTACHMENT",
        false
      );
    }

    names.add(filename);

    prepared.push({
      filename,

      content:
        bytes.toString("base64"),

      content_type:
        "application/pdf",
    });
  }

  return prepared;
}

/* ============================================================
   VALIDATION DU MESSAGE
============================================================ */

function validateMessage(
  input: SendEmailInput
): void {
  normalizeEmail(input.to);

  if (!validSubject(input.subject)) {
    throw new EmailSendError(
      "INVALID_MESSAGE",
      false
    );
  }

  if (
    typeof input.html !== "string" ||
    input.html.trim().length === 0 ||
    input.html.length > MAX_HTML_LENGTH
  ) {
    throw new EmailSendError(
      "INVALID_MESSAGE",
      false
    );
  }

  if (
    typeof input.text !== "string" ||
    input.text.trim().length === 0 ||
    input.text.length > MAX_TEXT_LENGTH
  ) {
    throw new EmailSendError(
      "INVALID_MESSAGE",
      false
    );
  }

  validateIdempotencyKey(
    input.idempotencyKey
  );

  if (
    input.replyTo &&
    !validEmail(input.replyTo)
  ) {
    throw new EmailSendError(
      "INVALID_REPLY_TO",
      false
    );
  }
}

/* ============================================================
   RÉPONSE DU FOURNISSEUR
============================================================ */

function extractProviderMessageId(
  value: unknown
): string {
  if (!isRecord(value)) {
    throw new EmailSendError(
      "EMAIL_RESPONSE_INVALID",
      true,
      null,
      true
    );
  }

  const id = value.id;

  if (
    typeof id !== "string" ||
    id.trim().length === 0 ||
    id.length > 255
  ) {
    throw new EmailSendError(
      "EMAIL_RESPONSE_INVALID",
      true,
      null,
      true
    );
  }

  return id.trim();
}

/* ============================================================
   CLASSIFICATION DES ERREURS
============================================================ */

/**
 * Réponses 429, 408 et 5xx :
 * une nouvelle tentative peut être utile.
 *
 * Réponses 400, 401, 403 et 422 :
 * intervention sur les données ou la
 * configuration généralement nécessaire.
 *
 * Le worker conserve la même clé
 * d'idempotence lors des reprises.
 */

function providerError(
  status: number
): EmailSendError {
  if (status === 429) {
    return new EmailSendError(
      "EMAIL_RATE_LIMITED",
      true,
      status
    );
  }

  if (
    status === 408 ||
    status >= 500
  ) {
    return new EmailSendError(
      "EMAIL_PROVIDER_UNAVAILABLE",
      true,
      status,
      true
    );
  }

  return new EmailSendError(
    "EMAIL_PROVIDER_REJECTED",
    false,
    status
  );
}

/* ============================================================
   ENVOI RÉEL PAR RESEND
============================================================ */

/**
 * Fonction principale.
 *
 * Le fournisseur reçoit :
 *
 * - L'expéditeur
 * - Le destinataire
 * - Le sujet
 * - Le HTML
 * - Le texte
 * - Les PDF
 * - La clé d'idempotence
 *
 * Le retour accepted signifie que Resend
 * a accepté la demande d'envoi.
 *
 * Il ne garantit pas la remise en boîte
 * de réception. La livraison doit être
 * suivie séparément si nécessaire.
 */


/* ============================================================
   ENVOI RÉEL PAR RESEND
============================================================ */
/**
 * Fonction principale.
 *
 * Le fournisseur reçoit :
 *
 * - L'expéditeur
 * - Le destinataire
 * - Le sujet
 * - Le HTML
 * - Le texte
 * - Les PDF
 * - La clé d'idempotence
 *
 * Le retour accepted signifie que Resend
 * a accepté la demande d'envoi.
 *
 * Il ne garantit pas la remise en boîte
 * de réception. La livraison doit être
 * suivie séparément si nécessaire.
 */
function emailSnapshotKey(key: string) { return "tikemia:email:payload:" + createHash("sha256").update(key).digest("hex"); }
function snapshotSecret() { const secret = process.env.TIKEMIA_TICKET_QR_SECRET || process.env.TIKEMIA_OTP_SECRET; if (!secret)
    throw new EmailSendError("EMAIL_CONFIG_MISSING", false); return createHash("sha256").update(secret).digest(); }
export async function prepareEmailSnapshot(key: string, body: string): Promise<{
    body: string;
    providerMessageId?: string;
}> {
    const db = getPlatformPrisma(), settingKey = emailSnapshotKey(key), iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", snapshotSecret(), iv);
    cipher.setAAD(Buffer.from(settingKey));
    const ciphertext = Buffer.concat([cipher.update(body, "utf8"), cipher.final()]);
    const value = { iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: ciphertext.toString("base64"), createdAt: new Date().toISOString() };
    await db.appSetting.createMany({ data: [{ key: settingKey, value }], skipDuplicates: true });
    const stored = await db.appSetting.findUniqueOrThrow({ where: { key: settingKey } }), v = stored.value;
    if (!isRecord(v) || typeof v.iv !== "string" || typeof v.tag !== "string" || typeof v.data !== "string" || typeof v.createdAt !== "string")
        throw new EmailSendError("EMAIL_RESPONSE_INVALID", false);
    if (typeof v.providerMessageId === "string")
        return { body: "", providerMessageId: v.providerMessageId };
    // After the provider's 24-hour deduplication window, an uncertain send requires reconciliation.
    if (Date.now() - Date.parse(v.createdAt) > 23 * 60 * 60 * 1000)
        throw new EmailSendError("EMAIL_RESPONSE_INVALID", false, null, true);
    const decipher = createDecipheriv("aes-256-gcm", snapshotSecret(), Buffer.from(v.iv, "base64"));
    decipher.setAAD(Buffer.from(settingKey));
    decipher.setAuthTag(Buffer.from(v.tag, "base64"));
    const original = Buffer.concat([decipher.update(Buffer.from(v.data, "base64")), decipher.final()]).toString("utf8");
    if (JSON.stringify(JSON.parse(original).to) !== JSON.stringify(JSON.parse(body).to))
        throw new EmailSendError("INVALID_RECIPIENT", false);
    return { body: original };
}
export async function rememberEmailReceipt(key: string, id: string) { const db = getPlatformPrisma(), settingKey = emailSnapshotKey(key), row = await db.appSetting.findUniqueOrThrow({ where: { key: settingKey } }); if (isRecord(row.value))
    await db.appSetting.update({ where: { key: settingKey }, data: { value: { ...row.value, providerMessageId: id } } }); }
export async function clearEmailSnapshot(key: string) { await getPlatformPrisma().appSetting.deleteMany({ where: { key: emailSnapshotKey(key) } }); }

export async function sendTikemiaEmail(
  input: SendEmailInput
): Promise<SendEmailResult> {
  validateMessage(input);

  const configuration =
    getEmailConfiguration();

  const recipient =
    normalizeEmail(input.to);

  const attachments =
    prepareAttachments(
      input.attachments ?? []
    );

  const snapshot = await prepareEmailSnapshot(input.idempotencyKey, JSON.stringify({
            from:
              configuration.from,

            to: [
              recipient,
            ],

            subject:
              input.subject,

            html:
              input.html,

            text:
              input.text,

            ...(
              input.replyTo ||
              configuration.replyTo
                ? {
                    reply_to:
                      input.replyTo ??
                      configuration.replyTo,
                  }
                : {}
            ),

            ...(
              attachments.length > 0
                ? {
                    attachments,
                  }
                : {}
            ),
          }));
  if (snapshot.providerMessageId) return { accepted: true, provider: "resend", providerMessageId: snapshot.providerMessageId, recipient, attachmentCount: attachments.length, status: "accepted" };
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS
    );

  try {
    const response =
      await fetch(
        RESEND_ENDPOINT,
        {
          method: "POST",

          signal:
            controller.signal,

          headers: {
            Authorization:
              `Bearer ${configuration.apiKey}`,

            "Content-Type":
              "application/json",

            Accept:
              "application/json",

            "Idempotency-Key":
              input.idempotencyKey,
          },

          body: snapshot.body,
        }
      );

    if (!response.ok) {
      throw providerError(
        response.status
      );
    }

    let parsed: unknown;

    try {
      parsed =
        await response.json();
    } catch {
      throw new EmailSendError(
        "EMAIL_RESPONSE_INVALID",
        true,
        response.status,
        true
      );
    }

    const providerMessageId =
      extractProviderMessageId(
        parsed
      );

    await rememberEmailReceipt(input.idempotencyKey, providerMessageId);
    return {
      accepted: true,

      provider: "resend",

      providerMessageId,

      recipient,

      attachmentCount:
        attachments.length,

      status: "accepted",
    };
  } catch (error) {
    if (
      error instanceof EmailSendError
    ) {
      throw error;
    }

    if (
      controller.signal.aborted
    ) {
      throw new EmailSendError(
        "EMAIL_REQUEST_TIMEOUT",
        true,
        null,
        true
      );
    }

    /*
     * Une erreur réseau ne signifie pas
     * nécessairement que le fournisseur
     * n'a pas accepté l'email.
     */

    throw new EmailSendError(
      "EMAIL_PROVIDER_UNAVAILABLE",
      true,
      null,
      true
    );
  } finally {
    clearTimeout(timeout);
  }
}

/* ============================================================
   CONVERSION DES PDF TIKEMIA
============================================================ */

function mapTicketPdfs(
  pdfs: readonly GeneratedTicketPdf[]
): EmailAttachment[] {
  if (
    !Array.isArray(pdfs) ||
    pdfs.length === 0
  ) {
    throw new EmailSendError(
      "TICKET_PDF_MISMATCH",
      false
    );
  }

  const ticketIds =
    new Set<string>();

  const documents:
    EmailAttachment[] = [];

  for (const pdf of pdfs) {
    if (
      !pdf ||
      !UUID_PATTERN.test(pdf.ticketId) ||
      !UUID_PATTERN.test(pdf.orderId) ||
      !pdf.ticketNumber ||
      pdf.mimeType !==
        "application/pdf" ||
      !Buffer.isBuffer(pdf.buffer) ||
      pdf.size !== pdf.buffer.length ||
      ticketIds.has(pdf.ticketId)
    ) {
      throw new EmailSendError(
        "TICKET_PDF_MISMATCH",
        false
      );
    }

    ticketIds.add(
      pdf.ticketId
    );

    documents.push({
      filename:
        pdf.filename,

      content:
        pdf.buffer,

      contentType:
        "application/pdf",
    });
  }

  return documents;
}

/* ============================================================
   EMAIL DES BILLETS
============================================================ */

/**
 * Fonction appelée par email/worker.ts.
 *
 * Les PDF doivent déjà avoir été générés
 * depuis les billets de la commande payée.
 *
 * Exemple :
 *
 * const result = await sendTicketPurchaseEmail({
 *   data: ticketEmailData,
 *   pdfs: generatedPdfs,
 *   idempotencyKey: makeEmailIdempotencyKey(
 *     delivery.id,
 *     "ticket_purchase"
 *   )
 * });
 */

export async function sendTicketPurchaseEmail(
  input: TicketEmailSendInput
): Promise<SendEmailResult> {
  if (
    !input ||
    !Array.isArray(input.pdfs) ||
    input.pdfs.length === 0
  ) {
    throw new EmailSendError(
      "TICKET_PDF_MISMATCH",
      false
    );
  }

  const rendered:
    RenderedEmail =
      buildTicketPurchaseEmail(
        input.data
      );

  /*
   * Tous les PDF doivent être associés
   * à une seule et même commande.
   */

  const orderIds =
    new Set(
      input.pdfs.map(
        (pdf) => pdf.orderId
      )
    );

  if (orderIds.size !== 1) {
    throw new EmailSendError(
      "TICKET_PDF_MISMATCH",
      false
    );
  }

  /*
   * On exige un PDF par billet annoncé
   * dans l'email.
   */

  if (
    input.pdfs.length !==
    input.data.tickets.length
  ) {
    throw new EmailSendError(
      "TICKET_PDF_MISMATCH",
      false
    );
  }

  const pdfNumbers =
    new Set(
      input.pdfs.map(
        (pdf) => pdf.ticketNumber
      )
    );

  for (const ticket of input.data.tickets) {
    if (
      !pdfNumbers.has(
        ticket.ticketNumber
      )
    ) {
      throw new EmailSendError(
        "TICKET_PDF_MISMATCH",
        false
      );
    }
  }

  const attachments =
    mapTicketPdfs(
      input.pdfs
    );

  return sendTikemiaEmail({
    to:
      input.data.recipientEmail,

    subject:
      rendered.subject,

    html:
      rendered.html,

    text:
      rendered.text,

    attachments,

    idempotencyKey:
      input.idempotencyKey,
  });
}

/* ============================================================
   EMAIL DE CONFIRMATION D'UN DON
============================================================ */

/**
 * La confirmation du don ne nécessite
 * aucune pièce jointe PDF.
 *
 * Le worker doit d'abord vérifier :
 *
 * - Donation.status = CONFIRMED
 * - Donation.confirmedAt non null
 * - Payment.status = SUCCEEDED
 *
 * Ensuite seulement il appelle cette
 * fonction avec les données vérifiées.
 */

export async function sendDonationConfirmationEmail(
  input: DonationEmailSendInput
): Promise<SendEmailResult> {
  const rendered =
    buildDonationConfirmationEmail(
      input.data
    );

  return sendTikemiaEmail({
    to:
      input.data.recipientEmail,

    subject:
      rendered.subject,

    html:
      rendered.html,

    text:
      rendered.text,

    idempotencyKey:
      input.idempotencyKey,

    attachments: [],
  });
}

/* ============================================================
   EXPORTS UTILITAIRES
============================================================ */

/**
 * Permet au worker de savoir si une
 * erreur mérite une nouvelle tentative.
 *
 * Les résultats incertains doivent
 * conserver la même idempotencyKey.
 */

export function isRetryableEmailError(
  error: unknown
): boolean {
  return (
    error instanceof EmailSendError &&
    error.retryable
  );
}

/**
 * Identifier une réponse incertaine.
 *
 * Le fournisseur peut avoir accepté
 * l'email sans que notre serveur ait
 * reçu sa confirmation.
 */

export function isUnknownEmailOutcome(
  error: unknown
): boolean {
  return (
    error instanceof EmailSendError &&
    error.outcomeUnknown
  );
}

export async function sendTransferredTicketEmail(input: TicketEmailSendInput): Promise<SendEmailResult> {
 const rendered = buildTicketPurchaseEmail(input.data);
 const attachments = mapTicketPdfs(input.pdfs);
 if (input.pdfs.length !== input.data.tickets.length || input.data.tickets.some(ticket => !input.pdfs.some(pdf => pdf.ticketNumber === ticket.ticketNumber))) throw new EmailSendError("TICKET_PDF_MISMATCH", false);
 return sendTikemiaEmail({ to: input.data.recipientEmail, subject: rendered.subject, html: rendered.html, text: rendered.text, attachments, idempotencyKey: input.idempotencyKey });
}
