import { prepareEmailSnapshot, rememberEmailReceipt, clearEmailSnapshot } from "@/lib/email/send";
import path from "node:path";
import { readFile, lstat, realpath } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { createDecipheriv } from "node:crypto";
import { formatMinorMoney } from "@/i18n/config";

import "server-only";

import {
  getPlatformPrisma,
} from "@/lib/payments/fulfillment";

/**
 * ============================================================
 * TIKEMIA — EMAILS DE CONFIRMATION DES RETRAITS
 * ============================================================
 *
 * Fichier :
 * src/lib/withdrawals/email.ts
 *
 * Service indépendant réservé aux retraits.
 *
 * Ne modifie pas :
 *
 * - src/lib/email/templates.ts
 * - src/lib/email/send.ts
 * - src/lib/email/worker.ts
 *
 * Ne modifie pas Prisma.
 *
 * Fonctionnement :
 *
 * 1. Lire les tâches WITHDRAWAL_EMAIL_QUEUED.
 * 2. Vérifier le retrait dans PostgreSQL.
 * 3. Vérifier son statut COMPLETED.
 * 4. Préparer un email FR ou EN.
 * 5. Envoyer l'email avec Resend.
 * 6. Enregistrer le succès dans AuditLog.
 * 7. Enregistrer les échecs.
 * 8. Permettre les nouvelles tentatives.
 *
 * Les demandes sont créées par :
 *
 * src/app/api/admin/withdrawals/[id]/route.ts
 *
 * Le service sera exécuté par :
 *
 * src/app/api/cron/withdrawal-emails/route.ts
 *
 * Aucun envoi d'email ne modifie
 * un solde, un paiement ou un retrait.
 *
 * ============================================================
 */

export const WITHDRAWAL_EMAIL_ACTIONS = {
  QUEUED: "WITHDRAWAL_EMAIL_QUEUED",
  SENT: "WITHDRAWAL_EMAIL_SENT",
  FAILED: "WITHDRAWAL_EMAIL_ATTEMPT_FAILED",
} as const;

/* ============================================================
   CONFIGURATION
============================================================ */

const MAX_BATCH_SIZE = 10;

const DEFAULT_BATCH_SIZE = 5;

const MAX_ATTEMPTS = 5;

const SEND_TIMEOUT_MS = 45000;

const RETRY_DELAYS_MS = [
  60_000,
  5 * 60_000,
  15 * 60_000,
  60 * 60_000,
] as const;

const RESEND_ENDPOINT =
  "https://api.resend.com/emails";

const EMAIL_TEMPLATE =
  "WITHDRAWAL_COMPLETED_V1";

/* ============================================================
   TYPES
============================================================ */

type Locale = "fr" | "en";

type QueueMetadata = {
  template: string;
  payoutId: string;
  recipient: string;
  locale: Locale;
  organizationName: string;
  ownerName: string;
  reference: string;
  amountMinor: string;
  currency: string;
  status: "QUEUED";
};

type EmailContent = {
  subject: string;
  html: string;
  text: string;
};

type EmailSendResult = {
  providerMessageId: string;
};

type JobResult =
  | "sent"
  | "already_sent"
  | "not_ready"
  | "failed"
  | "skipped";

export type WithdrawalEmailBatchResult = {
  checked: number;
  sent: number;
  alreadySent: number;
  failed: number;
  skipped: number;
  notReady: number;
};

type PendingJobRow = {
  id: string;
};

type LockedJobRow = {
  id: string;
  entityId: string | null;
  metadata: unknown;
};

type FailureInfo = {
  count: number;
  lastFailureAt: Date | null;
};

type EmailProviderErrorCode =
  | "PROVIDER_CONFIGURATION"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_REJECTED"
  | "PROVIDER_UNAVAILABLE"
  | "INVALID_PROVIDER_RESPONSE";

class WithdrawalEmailError extends Error {
  constructor(
    public readonly code: EmailProviderErrorCode
  ) {
    super(code);
    this.name = "WithdrawalEmailError";
  }
}

/* ============================================================
   VALIDATION
============================================================ */

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isUuid(
  value: unknown
): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function validEmail(
  value: unknown
): value is string {
  return (
    typeof value === "string" &&
    value.length <= 254 &&
    /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(
      value
    )
  );
}

function validName(
  value: unknown
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= 300
  );
}

function parseQueueMetadata(
  value: unknown
): QueueMetadata | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    value.template !== EMAIL_TEMPLATE ||
    !isUuid(value.payoutId) ||
    !validEmail(value.recipient) ||
    !validName(value.organizationName) ||
    !validName(value.ownerName) ||
    typeof value.reference !== "string" ||
    !value.reference.trim() ||
    value.reference.length > 150 ||
    typeof value.amountMinor !== "string" ||
    !/^[0-9]+$/.test(value.amountMinor) ||
    typeof value.currency !== "string" ||
    !/^[A-Z]{3}$/.test(value.currency) ||
    (
      value.locale !== "fr" &&
      value.locale !== "en"
    ) ||
    value.status !== "QUEUED"
  ) {
    return null;
  }

  return {
    template: value.template,
    payoutId: value.payoutId,
    recipient: value.recipient,
    locale: value.locale,
    organizationName: value.organizationName,
    ownerName: value.ownerName,
    reference: value.reference,
    amountMinor: value.amountMinor,
    currency: value.currency,
    status: "QUEUED",
  };
}

/* ============================================================
   FORMATAGE DES MONTANTS
============================================================ */

/**
 * Les montants sont stockés en BigInt,
 * dans la plus petite unité de la devise.
 *
 * XOF : 1000 = 1 000 FCFA
 * EUR : 1000 = 10,00 EUR
 *
 * Aucune conversion entre devises.
 */

function formatAmount(
  amountMinor: string,
  currency: string,
  locale: Locale
): string {
  return formatMinorMoney(amountMinor, currency, locale);
}

/* ============================================================
   FORMATAGE DE DATE
============================================================ */

function formatDate(
  date: Date,
  locale: Locale
): string {
  return new Intl.DateTimeFormat(
    locale === "fr"
      ? "fr-FR"
      : "en-GB",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }
  ).format(date);
}

/* ============================================================
   SÉCURITÉ DU HTML
============================================================ */

function escapeHtml(
  input: string
): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ============================================================
   MODÈLE EMAIL BILINGUE
============================================================ */

/**
 * Le design email reprend les couleurs :
 *
 * Vert TIKEMIA
 * Bleu marine
 * Blanc
 *
 * Compatible avec les principaux
 * clients de messagerie mobile et PC.
 *
 * Aucun IBAN complet.
 * Aucun numéro bancaire.
 * Aucun justificatif joint.
 */

export function buildWithdrawalEmail(
  input: {
    locale: Locale;
    ownerName: string;
    organizationName: string;
    reference: string;
    amountMinor: string;
    currency: string;
    completedAt: Date;
  }
): EmailContent {
  const isFrench =
    input.locale === "fr";

  const amount =
    formatAmount(
      input.amountMinor,
      input.currency,
      input.locale
    );

  const date =
    formatDate(
      input.completedAt,
      input.locale
    );

  const name =
    escapeHtml(input.ownerName);

  const organization =
    escapeHtml(input.organizationName);

  const reference =
    escapeHtml(input.reference);

  const safeAmount =
    escapeHtml(amount);

  const safeDate =
    escapeHtml(date);

  const subject =
    isFrench
      ? `TIKEMIA — Retrait effectué (${input.reference})`
      : `TIKEMIA — Withdrawal completed (${input.reference})`;

  const heading =
    isFrench
      ? "Votre retrait a été effectué"
      : "Your withdrawal is complete";

  const greeting =
    isFrench
      ? `Bonjour ${name},`
      : `Hello ${name},`;

  const description =
    isFrench
      ? "Nous vous confirmons que votre demande de retrait a été traitée et marquée comme effectuée par l'administration TIKEMIA."
      : "We confirm that your withdrawal request has been processed and marked as completed by the TIKEMIA administration.";

  const organizationLabel =
    isFrench
      ? "Organisation"
      : "Organization";

  const referenceLabel =
    isFrench
      ? "Référence du retrait"
      : "Withdrawal reference";

  const amountLabel =
    isFrench
      ? "Montant du retrait"
      : "Withdrawal amount";

  const dateLabel =
    isFrench
      ? "Date de confirmation"
      : "Confirmation date";

  const statusLabel =
    isFrench
      ? "Retrait effectué"
      : "Withdrawal completed";

  const note =
    isFrench
      ? "Vous pouvez consulter le statut de votre retrait dans votre espace organisateur TIKEMIA."
      : "You can view the status of your withdrawal in your TIKEMIA organizer account.";

  const footer =
    isFrench
      ? "Ceci est un message automatique relatif à votre retrait."
      : "This is an automated message concerning your withdrawal.";

  const text = isFrench
    ? [
        `Bonjour ${input.ownerName},`,
        "",
        "Votre retrait a été effectué.",
        "",
        `Organisation : ${input.organizationName}`,
        `Référence : ${input.reference}`,
        `Montant : ${amount}`,
        `Date de confirmation : ${date}`,
        "Statut : Retrait effectué",
        "",
        "Vous pouvez consulter le statut de votre retrait dans votre espace organisateur TIKEMIA.",
        "",
        "TIKEMIA",
      ].join("\n")
    : [
        `Hello ${input.ownerName},`,
        "",
        "Your withdrawal has been completed.",
        "",
        `Organization: ${input.organizationName}`,
        `Reference: ${input.reference}`,
        `Amount: ${amount}`,
        `Confirmation date: ${date}`,
        "Status: Withdrawal completed",
        "",
        "You can view your withdrawal status in your TIKEMIA organizer account.",
        "",
        "TIKEMIA",
      ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="${input.locale}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f6f4;font-family:Arial,Helvetica,sans-serif;color:#17283d;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f3f6f4;">
    <tr>
      <td align="center" style="padding:32px 14px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background:#ffffff;border:1px solid #e2e9e5;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:#10263d;padding:26px 28px;">
              <div style="font-size:25px;font-weight:800;letter-spacing:1px;color:#ffffff;">TIKEMIA</div>
              <div style="margin-top:7px;font-size:12px;color:#b5d3c2;">${isFrench ? "Confirmation de retrait" : "Withdrawal confirmation"}</div>
            </td>
          </tr>

          <tr>
            <td style="padding:30px 28px 12px;">
              <div style="display:inline-block;background:#e5f7e9;color:#087a32;border-radius:30px;padding:9px 14px;font-size:12px;font-weight:bold;">
                &#10003; ${statusLabel}
              </div>

              <h1 style="margin:22px 0 16px;font-size:24px;line-height:1.35;color:#14263b;">
                ${heading}
              </h1>

              <p style="font-size:15px;line-height:1.7;margin:0 0 14px;color:#33475b;">
                ${greeting}
              </p>

              <p style="font-size:14px;line-height:1.8;margin:0 0 24px;color:#586a79;">
                ${description}
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6faf7;border:1px solid #e2eee5;border-radius:12px;">
                <tr>
                  <td style="padding:22px;">
                    <div style="font-size:12px;color:#698071;">${amountLabel}</div>
                    <div style="margin-top:8px;font-size:28px;font-weight:800;color:#087a32;overflow-wrap:anywhere;">
                      ${safeAmount}
                    </div>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:23px;border-collapse:collapse;">
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid #ebefec;font-size:13px;color:#758493;">${organizationLabel}</td>
                  <td align="right" style="padding:12px 0;border-bottom:1px solid #ebefec;font-size:13px;font-weight:bold;color:#24384b;overflow-wrap:anywhere;">${organization}</td>
                </tr>
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid #ebefec;font-size:13px;color:#758493;">${referenceLabel}</td>
                  <td align="right" style="padding:12px 0;border-bottom:1px solid #ebefec;font-size:13px;font-weight:bold;color:#24384b;overflow-wrap:anywhere;">${reference}</td>
                </tr>
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid #ebefec;font-size:13px;color:#758493;">${dateLabel}</td>
                  <td align="right" style="padding:12px 0;border-bottom:1px solid #ebefec;font-size:13px;font-weight:bold;color:#24384b;">${safeDate}</td>
                </tr>
                <tr>
                  <td style="padding:12px 0;font-size:13px;color:#758493;">Status</td>
                  <td align="right" style="padding:12px 0;font-size:13px;font-weight:bold;color:#087a32;">${statusLabel}</td>
                </tr>
              </table>

              <p style="font-size:13px;line-height:1.8;color:#586a79;margin:25px 0 8px;">
                ${note}
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:23px 28px;background:#f8faf9;border-top:1px solid #e8eeea;">
              <div style="font-size:13px;font-weight:bold;color:#17283d;">TIKEMIA</div>
              <div style="margin-top:7px;font-size:11px;line-height:1.6;color:#83918d;">${footer}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    subject,
    html,
    text,
  };
}

/* ============================================================
   CONFIGURATION RESEND
============================================================ */

function getEmailConfiguration(): {
  apiKey: string;
  from: string;
} {
  const apiKey =
    process.env.RESEND_API_KEY?.trim();

  const from =
    process.env.WITHDRAWAL_EMAIL_FROM?.trim() ||
    process.env.TIKEMIA_EMAIL_FROM?.trim() ||
    process.env.EMAIL_FROM?.trim();

  if (
    !apiKey ||
    !apiKey.trim() ||
    !from ||
    !from.trim()
  ) {
    throw new WithdrawalEmailError(
      "PROVIDER_CONFIGURATION"
    );
  }

  return {
    apiKey,
    from,
  };
}

/* ============================================================
   ENVOI RESEND
============================================================ */

/**
 * Idempotency-Key :
 *
 * Chaque tâche conserve la même clé
 * lors de ses tentatives d'envoi.
 *
 * Cela réduit le risque de double envoi
 * lorsque la même requête est rejouée.
 *
 * Il faut également contrôler l'état
 * dans PostgreSQL.
 *
 * Aucun email ne part directement
 * depuis le navigateur.
 */


/* ============================================================
   ENVOI RESEND
============================================================ */
/**
 * Idempotency-Key :
 *
 * Chaque tâche conserve la même clé
 * lors de ses tentatives d'envoi.
 *
 * Cela réduit le risque de double envoi
 * lorsque la même requête est rejouée.
 *
 * Il faut également contrôler l'état
 * dans PostgreSQL.
 *
 * Aucun email ne part directement
 * depuis le navigateur.
 */
async function loadWithdrawalProof(tx: Pick<ReturnType<typeof getPlatformPrisma>, "auditLog">, payoutId: string, amount: string, currency: string) {
    const completion = await tx.auditLog.findFirst({ where: { entity: "Payout", entityId: payoutId, action: "WITHDRAWAL_COMPLETED" }, orderBy: { createdAt: "desc" }, select: { metadata: true } });
    const completionData = completion?.metadata;
    if (!isRecord(completionData) || typeof completionData.proofAuditId !== "string")
        throw new WithdrawalEmailError("PROVIDER_UNAVAILABLE");
    const audit = await tx.auditLog.findFirst({ where: { id: completionData.proofAuditId, entity: "Payout", entityId: payoutId, action: "WITHDRAWAL_PROOF_UPLOADED" }, select: { metadata: true, actorId: true } });
    const m = audit?.metadata;
    if (!isRecord(m) || typeof m.storageKey !== "string" || !m.storageKey.startsWith(`withdrawals/${payoutId}/`) || typeof m.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(m.sha256) || m.amountMinor !== amount || m.currency !== currency || m.destinationId !== completionData.destinationId || m.uploadedBy !== audit?.actorId || typeof m.size !== "number" || m.size <= 0 || m.size > 10 * 1024 * 1024)
        throw new WithdrawalEmailError("PROVIDER_UNAVAILABLE");
    const root = path.resolve(/* turbopackIgnore: true */ process.env.TIKEMIA_WITHDRAWALS_PROOF_DIR || path.join(process.cwd(), "private", "withdrawal-proofs"));
    const file = path.resolve(/* turbopackIgnore: true */ root, m.storageKey);
    const realRoot = await realpath(/* turbopackIgnore: true */ root), realFile = await realpath(/* turbopackIgnore: true */ file);
    const publicRoot = path.resolve(process.cwd(), "public");
    if (!file.startsWith(root + path.sep) || !realFile.startsWith(realRoot + path.sep) || realRoot === publicRoot || realRoot.startsWith(publicRoot + path.sep))
        throw new WithdrawalEmailError("PROVIDER_UNAVAILABLE");
    const info = await lstat(/* turbopackIgnore: true */ file);
    if (!info.isFile() || info.isSymbolicLink() || info.size !== m.size)
        throw new WithdrawalEmailError("PROVIDER_UNAVAILABLE");
    const bytes = await readFile(/* turbopackIgnore: true */ file);
    if (bytes.length !== m.size || createHash("sha256").update(bytes).digest("hex") !== m.sha256)
        throw new WithdrawalEmailError("PROVIDER_UNAVAILABLE");
    const extensions: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
    const ext = typeof m.mimeType === "string" ? extensions[m.mimeType] : undefined;
    const magic = ext === "pdf" ? bytes.subarray(0, 5).toString("ascii") === "%PDF-" : ext === "jpg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : ext === "png" ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) : ext === "webp" && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
    if (!ext || !magic)
        throw new WithdrawalEmailError("PROVIDER_UNAVAILABLE");
    return { filename: `preuve-retrait.${ext}`, content: bytes.toString("base64"), content_type: String(m.mimeType) };
}

async function sendWithResend(
  input: {
    recipient: string;
    content: EmailContent;
    idempotencyKey: string;
    attachment: { filename: string; content: string; content_type: string };
  }
): Promise<EmailSendResult> {
  const config =
    getEmailConfiguration();

  const snapshot = await prepareEmailSnapshot(input.idempotencyKey, JSON.stringify({
          attachments: [input.attachment],
          from: config.from,
          to: [input.recipient],

          subject:
            input.content.subject,

          html:
            input.content.html,

          text:
            input.content.text,
        }));
  if(snapshot.providerMessageId) return {providerMessageId:snapshot.providerMessageId};
  let response: Response;

  try {
    response = await fetch(
      RESEND_ENDPOINT,
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${config.apiKey}`,

          "Content-Type":
            "application/json",

          "Idempotency-Key":
            input.idempotencyKey,
        },

        body: snapshot.body,

        signal:
          AbortSignal.timeout(
            SEND_TIMEOUT_MS
          ),

        cache: "no-store",
      }
    );
  } catch (error) {
    if (
      error instanceof Error &&
      (
        error.name === "TimeoutError" ||
        error.name === "AbortError"
      )
    ) {
      throw new WithdrawalEmailError(
        "PROVIDER_TIMEOUT"
      );
    }

    throw new WithdrawalEmailError(
      "PROVIDER_UNAVAILABLE"
    );
  }

  if (!response.ok) {
    throw new WithdrawalEmailError(
      "PROVIDER_REJECTED"
    );
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new WithdrawalEmailError(
      "INVALID_PROVIDER_RESPONSE"
    );
  }

  if (
    !isRecord(payload) ||
    !isUuid(payload.id)
  ) {
    throw new WithdrawalEmailError(
      "INVALID_PROVIDER_RESPONSE"
    );
  }

  await rememberEmailReceipt(input.idempotencyKey, payload.id);
  return {
    providerMessageId:
      payload.id,
  };
}

/* ============================================================
   REPRISE DES ENVOIS
============================================================ */

function getRetryDelay(
  failures: number
): number {
  const index =
    Math.max(
      0,
      Math.min(
        failures - 1,
        RETRY_DELAYS_MS.length - 1
      )
    );

  return RETRY_DELAYS_MS[index];
}

function retryAllowed(
  info: FailureInfo
): boolean {
  if (
    info.count >= MAX_ATTEMPTS
  ) {
    return false;
  }

  if (!info.lastFailureAt) {
    return true;
  }

  const delay =
    getRetryDelay(info.count);

  return (
    Date.now() -
      info.lastFailureAt.getTime() >=
    delay
  );
}

/* ============================================================
   TRAITEMENT D'UNE TÂCHE
============================================================ */

/**
 * L'envoi est sérialisé par verrou PostgreSQL
 * sur la ligne AuditLog de la tâche.
 *
 * SELECT FOR UPDATE SKIP LOCKED :
 *
 * Deux workers concurrents ne peuvent pas
 * traiter simultanément la même ligne.
 *
 * L'appel Resend est effectué pendant
 * la transaction.
 *
 * C'est intentionnel pour protéger
 * l'envoi concurrent, mais implique
 * une transaction courte et un timeout.
 *
 * La clé d'idempotence Resend réduit
 * les doublons lorsqu'une transaction
 * échoue après acceptation de l'email.
 */


/* ============================================================
   TRAITEMENT D'UNE TÂCHE
============================================================ */
/**
 * L'envoi est sérialisé par verrou PostgreSQL
 * sur la ligne AuditLog de la tâche.
 *
 * SELECT FOR UPDATE SKIP LOCKED :
 *
 * Deux workers concurrents ne peuvent pas
 * traiter simultanément la même ligne.
 *
 * L'appel Resend est effectué pendant
 * la transaction.
 *
 * C'est intentionnel pour protéger
 * l'envoi concurrent, mais implique
 * une transaction courte et un timeout.
 *
 * La clé d'idempotence Resend réduit
 * les doublons lorsqu'une transaction
 * échoue après acceptation de l'email.
 */
async function processOneWithdrawalEmail(jobId: string): Promise<JobResult> {
    if (!isUuid(jobId))
        return "skipped";
    const db = getPlatformPrisma(), leaseKey = "tikemia:withdrawal-email:lease:" + jobId, claimId = randomUUID();
    const prepared = await db.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<LockedJobRow[]> `SELECT "id"::text AS "id","entityId","metadata" FROM "AuditLog" WHERE "id"=${jobId}::uuid AND "action"='WITHDRAWAL_EMAIL_QUEUED' AND "entity"='Payout' FOR UPDATE SKIP LOCKED`;
        const job = rows[0], metadata = job ? parseQueueMetadata(job.metadata) : null;
        if (!metadata || job.entityId !== metadata.payoutId)
            return { status: "skipped" as const };
        if (await tx.auditLog.findFirst({ where: { entity: "Payout", entityId: metadata.payoutId, action: WITHDRAWAL_EMAIL_ACTIONS.SENT, metadata: { path: ["proofAttached"], equals: true } }, select: { id: true } }))
            return { status: "already_sent" as const };
        const lease = await tx.appSetting.findUnique({ where: { key: leaseKey }, select: { value: true } });
        if (isRecord(lease?.value) && typeof lease.value.lockedUntil === "string" && Date.parse(lease.value.lockedUntil) > Date.now())
            return { status: "not_ready" as const };
        const [failures, lastFailure] = await Promise.all([tx.auditLog.count({ where: { entity: "Payout", entityId: metadata.payoutId, action: WITHDRAWAL_EMAIL_ACTIONS.FAILED } }), tx.auditLog.findFirst({ where: { entity: "Payout", entityId: metadata.payoutId, action: WITHDRAWAL_EMAIL_ACTIONS.FAILED }, orderBy: { createdAt: "desc" }, select: { createdAt: true } })]);
        if (!retryAllowed({ count: failures, lastFailureAt: lastFailure?.createdAt ?? null }))
            return { status: "not_ready" as const };
        const payout = await tx.payout.findUnique({ where: { id: metadata.payoutId }, include: { organization: { include: { owner: true } } } });
        if (!payout || payout.status !== "COMPLETED" || !payout.completedAt || payout.reference !== metadata.reference || payout.amount.toString() !== metadata.amountMinor || payout.currency !== metadata.currency || payout.organization.owner.email.toLowerCase() !== metadata.recipient.toLowerCase())
            return { status: "skipped" as const };
        const value = { claimId, lockedUntil: new Date(Date.now() + 120000).toISOString() };
        await tx.appSetting.upsert({ where: { key: leaseKey }, create: { key: leaseKey, value }, update: { value } });
        const content = buildWithdrawalEmail({ locale: metadata.locale, ownerName: payout.organization.owner.fullName, organizationName: payout.organization.name, reference: payout.reference, amountMinor: payout.amount.toString(), currency: payout.currency, completedAt: payout.completedAt });
        return { status: "ready" as const, payoutId: payout.id, recipient: metadata.recipient, amount: payout.amount.toString(), currency: payout.currency, content, failures };
    }, { maxWait: 10000, timeout: 20000 });
    if (prepared.status !== "ready")
        return prepared.status;
    // File IO and the email provider run outside database transactions.
    try {
        const attachment = await loadWithdrawalProof(db, prepared.payoutId, prepared.amount, prepared.currency);
        const sent = await sendWithResend({ recipient: prepared.recipient, content: prepared.content, attachment, idempotencyKey: `tikemia-withdrawal-proof-${jobId}` });
        return await db.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT "id" FROM "AuditLog" WHERE "id"=${jobId}::uuid FOR UPDATE`;
            const lease = await tx.appSetting.findUnique({ where: { key: leaseKey }, select: { value: true } });
            if (!isRecord(lease?.value) || lease.value.claimId !== claimId)
                return "skipped";
            await tx.auditLog.create({ data: { entity: "Payout", entityId: prepared.payoutId, action: WITHDRAWAL_EMAIL_ACTIONS.SENT, metadata: { jobId, template: EMAIL_TEMPLATE, provider: "resend", providerMessageId: sent.providerMessageId, recipient: prepared.recipient, proofAttached: true, status: "SENT" } } });
            await tx.appSetting.delete({ where: { key: leaseKey } });
            return "sent";
        });
    }
    catch (error) {
        await db.$transaction(async (tx) => {
            const lease = await tx.appSetting.findUnique({ where: { key: leaseKey }, select: { value: true } });
            if (!isRecord(lease?.value) || lease.value.claimId !== claimId)
                return;
            await tx.auditLog.create({ data: { entity: "Payout", entityId: prepared.payoutId, action: WITHDRAWAL_EMAIL_ACTIONS.FAILED, metadata: { jobId, template: EMAIL_TEMPLATE, attempt: prepared.failures + 1, errorCode: error instanceof WithdrawalEmailError ? error.code : "PROVIDER_UNAVAILABLE" } } });
            await tx.appSetting.delete({ where: { key: leaseKey } });
        });
        console.error("[TIKEMIA_WITHDRAWAL_EMAIL_SEND]", error instanceof Error ? error.name : "UNKNOWN");
        return "failed";
    }
}


/* ============================================================
   SÉLECTION DES TÂCHES EN ATTENTE
============================================================ */

/**
 * On sélectionne uniquement :
 *
 * - Les tâches créées par le service retrait
 * - Les tâches sans email déjà envoyé
 * - Les tâches avec moins de 5 échecs
 *
 * La vérification finale est toujours
 * effectuée à l'intérieur de la transaction.
 */

async function findPendingJobs(
  limit: number
): Promise<PendingJobRow[]> {
  const prisma =
    getPlatformPrisma();

  return prisma.$queryRaw<
    PendingJobRow[]
  >`
    SELECT
      queued."id"::text AS "id"

    FROM "AuditLog" AS queued

    WHERE
      queued."action" =
        'WITHDRAWAL_EMAIL_QUEUED'

      AND queued."entity" =
        'Payout'

      AND queued."entityId"
        IS NOT NULL

      AND NOT EXISTS (
        SELECT 1
        FROM "AuditLog" AS sent

        WHERE
          sent."entity" = 'Payout'

          AND sent."entityId" =
            queued."entityId"

          AND sent."action" =
            'WITHDRAWAL_EMAIL_SENT'
          AND sent."metadata"->>'proofAttached' = 'true'
      )

      AND (
        SELECT COUNT(*)
        FROM "AuditLog" AS failures

        WHERE
          failures."entity" = 'Payout'

          AND failures."entityId" =
            queued."entityId"

          AND failures."action" =
            'WITHDRAWAL_EMAIL_ATTEMPT_FAILED'
      ) < ${MAX_ATTEMPTS}

    ORDER BY
      queued."createdAt" ASC,
      queued."id" ASC

    LIMIT ${limit}
  `;
}

/* ============================================================
   TRAITEMENT DU LOT
============================================================ */

/**
 * Fonction à appeler uniquement depuis
 * le cron serveur authentifié :
 *
 * processWithdrawalEmailQueue()
 *
 * Retourne un résumé technique.
 *
 * N'accepte aucun destinataire
 * fourni par un navigateur.
 *
 * Tous les destinataires viennent
 * des retraits confirmés en base.
 */

export async function processWithdrawalEmailQueue(
  options: {
    limit?: number;
  } = {}
): Promise<WithdrawalEmailBatchResult> {
  const limit =
    Math.min(
      MAX_BATCH_SIZE,
      Math.max(
        1,
        Number.isInteger(options.limit)
          ? options.limit!
          : DEFAULT_BATCH_SIZE
      )
    );

  const result:
    WithdrawalEmailBatchResult = {
      checked: 0,
      sent: 0,
      alreadySent: 0,
      failed: 0,
      skipped: 0,
      notReady: 0,
    };

  const jobs =
    await findPendingJobs(
      limit
    );

  const startedAt = Date.now();
  for (const job of jobs) {
    if (Date.now() - startedAt >= 45000) break;
    result.checked += 1;

    try {
      const status =
        await processOneWithdrawalEmail(
          job.id
        );

      switch (status) {
        case "sent":
          try { await clearEmailSnapshot(`tikemia-withdrawal-proof-${job.id}`); } catch { /* Already committed. */ }
          result.sent += 1;
          break;

        case "already_sent":
          result.alreadySent += 1;
          break;

        case "failed":
          result.failed += 1;
          break;

        case "not_ready":
          result.notReady += 1;
          break;

        default:
          result.skipped += 1;
          break;
      }
    } catch (error) {
      /*
       * Une exception de transaction
       * ne doit pas empêcher le traitement
       * des autres demandes du lot.
       */

      result.failed += 1;

      console.error(
        "[TIKEMIA_WITHDRAWAL_EMAIL_JOB]",
        error instanceof Error
          ? error.name
          : "UNKNOWN_ERROR"
      );
    }
  }

  return result;
}

export function decryptWithdrawalDetails(encrypted: string): Record<string, string> | null {
 const keys: Buffer[] = [];
 if (process.env.TIKEMIA_PAYOUT_ENCRYPTION_KEY) { const key = Buffer.from(process.env.TIKEMIA_PAYOUT_ENCRYPTION_KEY, "base64"); if (key.length === 32) keys.push(key); }
 if (process.env.TIKEMIA_WITHDRAWAL_DESTINATION_KEY && /^[a-f0-9]{64}$/i.test(process.env.TIKEMIA_WITHDRAWAL_DESTINATION_KEY)) keys.push(Buffer.from(process.env.TIKEMIA_WITHDRAWAL_DESTINATION_KEY, "hex"));
 const [version, ivText, tagText, cipherText, extra] = encrypted.split(":");
 if (version !== "v1" || extra || !ivText || !tagText || !cipherText || cipherText.length > 22000 || ![ivText,tagText,cipherText].every(value => /^[A-Za-z0-9_-]+$/.test(value))) return null;
 const iv = Buffer.from(ivText,"base64url"), tag = Buffer.from(tagText,"base64url"), ciphertext = Buffer.from(cipherText,"base64url");
 if (iv.length !== 12 || tag.length !== 16) return null;
 for (const key of keys) { try { const decipher = createDecipheriv("aes-256-gcm",key,iv); decipher.setAuthTag(tag); const data: unknown = JSON.parse(Buffer.concat([decipher.update(ciphertext),decipher.final()]).toString("utf8")); if (!data || typeof data !== "object" || Array.isArray(data)) continue; const details: Record<string,string> = {}; for (const field of ["reference","accountRef","iban","bic","swift","accountNumber","routingCode","bankCode","branchCode","mobileMoneyNumber","walletAddress","additionalInformation"]) { const value = (data as Record<string,unknown>)[field]; if (typeof value === "string" && value.trim()) details[field] = value.trim().slice(0,1000); } return Object.keys(details).length ? details : null; } catch { /* Compatible legacy key. */ } }
 return null;
}
