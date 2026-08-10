import "server-only";

import {
  Resend,
} from "resend";

export type SendPayoutApprovedEmailInput =
  Readonly<{
    to: string;
    organizerName: string;
    payoutId: string;
    reference?: string | null;
    amount: string;
    fee?: string | null;
    netAmount?: string | null;
    currency: string;
    destinationType?: string | null;
    processedAt?: Date | string | null;
    estimatedDelay?: string | null;
  }>;

export type SendPayoutApprovedEmailResult =
  Readonly<{
    sent: boolean;
    provider: "RESEND";
    providerMessageId: string | null;
    recipient: string;
  }>;

function normalizeRequired(
  value: string,
  label: string,
): string {
  const normalized =
    value.replace(/\s+/g, " ").trim();

  if (!normalized) {
    throw new Error(
      `${label} est obligatoire.`,
    );
  }

  return normalized;
}

function normalizeOptional(
  value:
    | string
    | null
    | undefined,
): string | null {
  const normalized =
    value?.replace(/\s+/g, " ").trim() ?? "";

  return normalized || null;
}

function escapeHtml(
  value: string,
): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getResendClient(): Resend {
  const apiKey =
    process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY est manquante.",
    );
  }

  return new Resend(apiKey);
}

function getFromAddress(): string {
  return (
    process.env.PAYOUT_EMAIL_FROM?.trim() ||
    process.env.MAIL_FROM?.trim() ||
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "Tikemia <noreply@tikemia.com>"
  );
}

function getSupportEmail(): string {
  return (
    process.env.SUPPORT_EMAIL?.trim() ||
    "support@tikemia.com"
  );
}

function formatDate(
  value:
    | Date
    | string
    | null
    | undefined,
): string {
  if (!value) {
    return "Non précisée";
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Non précisée";
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      dateStyle:
        "long",
      timeStyle:
        "short",
      timeZone:
        process.env.APP_TIMEZONE?.trim() ||
        "Africa/Porto-Novo",
    },
  ).format(date);
}

function formatAmount(
  amount: string,
  currency: string,
): string {
  const numeric =
    Number(amount);

  if (
    !Number.isFinite(
      numeric,
    )
  ) {
    return `${amount} ${currency}`;
  }

  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style:
          "currency",
        currency,
        maximumFractionDigits:
          2,
      },
    ).format(numeric);
  } catch {
    return `${numeric.toLocaleString(
      "fr-FR",
    )} ${currency}`;
  }
}

export async function sendPayoutApprovedEmail(
  input: SendPayoutApprovedEmailInput,
): Promise<SendPayoutApprovedEmailResult> {
  const recipient =
    normalizeRequired(
      input.to,
      "L’adresse e-mail du destinataire",
    );

  const organizerName =
    normalizeRequired(
      input.organizerName,
      "Le nom de l’organisateur",
    );

  const payoutId =
    normalizeRequired(
      input.payoutId,
      "L’identifiant du retrait",
    );

  const amount =
    normalizeRequired(
      input.amount,
      "Le montant",
    );

  const currency =
    normalizeRequired(
      input.currency,
      "La devise",
    ).toUpperCase();

  const reference =
    normalizeOptional(
      input.reference,
    ) ?? payoutId;

  const fee =
    normalizeOptional(
      input.fee,
    );

  const netAmount =
    normalizeOptional(
      input.netAmount,
    );

  const destinationType =
    normalizeOptional(
      input.destinationType,
    ) ?? "Destination enregistrée";

  const estimatedDelay =
    normalizeOptional(
      input.estimatedDelay,
    ) ??
    "Le traitement final dépend du moyen de retrait sélectionné.";

  const resend =
    getResendClient();

  const subject =
    `Votre retrait Tikemia a été approuvé — ${reference}`;

  const text = [
    `Bonjour ${organizerName},`,
    "",
    "Votre demande de retrait Tikemia a été approuvée.",
    `Référence : ${reference}`,
    `Montant demandé : ${formatAmount(amount, currency)}`,
    fee
      ? `Frais : ${formatAmount(fee, currency)}`
      : null,
    netAmount
      ? `Montant net : ${formatAmount(netAmount, currency)}`
      : null,
    `Destination : ${destinationType}`,
    `Date de traitement : ${formatDate(input.processedAt)}`,
    `Délai estimé : ${estimatedDelay}`,
    "",
    "Vous recevrez une nouvelle notification lorsque le paiement sera finalisé.",
    "",
    `Support Tikemia : ${getSupportEmail()}`,
  ]
    .filter(
      (
        line,
      ): line is string =>
        line !== null,
    )
    .join("\n");

  const html =
    `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <div style="max-width:680px;margin:0 auto;padding:24px;">
    <div style="height:7px;border-radius:16px 16px 0 0;background:linear-gradient(90deg,#10b981,#a3e635,#f97316);"></div>
    <div style="background:#061015;padding:28px;border-radius:0 0 16px 16px;">
      <div style="font-size:24px;font-weight:900;color:#a3e635;">TIKEMIA</div>
      <p style="margin:18px 0 6px;font-size:12px;font-weight:800;letter-spacing:1.5px;color:#34d399;">RETRAIT APPROUVÉ</p>
      <h1 style="margin:0;font-size:28px;line-height:1.2;color:#ffffff;">Votre demande a été validée</h1>
      <p style="margin:16px 0 0;color:#cbd5e1;line-height:1.7;">Bonjour ${escapeHtml(organizerName)}, votre demande de retrait a été approuvée par l’administration Tikemia.</p>
    </div>

    <div style="background:#ffffff;padding:26px;border-radius:16px;margin-top:14px;border:1px solid #e5e7eb;">
      <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:10px 0;color:#6b7280;">Référence</td><td style="padding:10px 0;text-align:right;font-weight:800;">${escapeHtml(reference)}</td></tr>
        <tr><td style="padding:10px 0;color:#6b7280;">Montant demandé</td><td style="padding:10px 0;text-align:right;font-weight:800;">${escapeHtml(formatAmount(amount, currency))}</td></tr>
        ${fee ? `<tr><td style="padding:10px 0;color:#6b7280;">Frais</td><td style="padding:10px 0;text-align:right;font-weight:800;">${escapeHtml(formatAmount(fee, currency))}</td></tr>` : ""}
        ${netAmount ? `<tr><td style="padding:10px 0;color:#6b7280;">Montant net</td><td style="padding:10px 0;text-align:right;font-weight:900;color:#059669;">${escapeHtml(formatAmount(netAmount, currency))}</td></tr>` : ""}
        <tr><td style="padding:10px 0;color:#6b7280;">Destination</td><td style="padding:10px 0;text-align:right;font-weight:800;">${escapeHtml(destinationType)}</td></tr>
        <tr><td style="padding:10px 0;color:#6b7280;">Date de traitement</td><td style="padding:10px 0;text-align:right;font-weight:800;">${escapeHtml(formatDate(input.processedAt))}</td></tr>
      </table>

      <div style="margin-top:20px;padding:16px;border-radius:12px;background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;line-height:1.6;">
        <strong>Délai estimé :</strong> ${escapeHtml(estimatedDelay)}
      </div>
    </div>

    <p style="margin:18px 0 0;text-align:center;font-size:12px;color:#6b7280;">
      Cet e-mail a été envoyé automatiquement par Tikemia.<br />
      Support : ${escapeHtml(getSupportEmail())}
    </p>
  </div>
</body>
</html>`;

  const result =
    await resend.emails.send({
      from:
        getFromAddress(),
      to: [
        recipient,
      ],
      subject,
      html,
      text,
      replyTo:
        getSupportEmail(),
    });

  if (result.error) {
    throw new Error(
      result.error.message ||
      "Resend n’a pas pu envoyer l’e-mail d’approbation du retrait.",
    );
  }

  return {
    sent:
      true,
    provider:
      "RESEND",
    providerMessageId:
      result.data?.id ??
      null,
    recipient,
  };
}
