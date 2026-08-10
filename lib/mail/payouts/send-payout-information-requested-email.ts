import "server-only";

import {
  Resend,
} from "resend";

export type SendPayoutInformationRequestedEmailInput =
  Readonly<{
    to: string;
    organizerName: string;
    payoutId: string;
    reference?: string | null;
    amount: string;
    currency: string;
    message: string;
    requestedFields?: readonly string[];
    requestedAt?: Date | string | null;
    responseUrl?: string | null;
  }>;

export type SendPayoutInformationRequestedEmailResult =
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
    value?.trim() ?? "";

  return normalized || null;
}

function normalizeFields(
  values:
    | readonly string[]
    | undefined,
): string[] {
  if (!values) {
    return [];
  }

  return Array.from(
    new Set(
      values
        .map((value) =>
          value.replace(/\s+/g, " ").trim(),
        )
        .filter(Boolean),
    ),
  ).slice(0, 20);
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

function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    "https://tikemia.com"
  ).replace(/\/+$/, "");
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

export async function sendPayoutInformationRequestedEmail(
  input: SendPayoutInformationRequestedEmailInput,
): Promise<SendPayoutInformationRequestedEmailResult> {
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

  const message =
    normalizeRequired(
      input.message,
      "Le message",
    );

  const reference =
    normalizeOptional(
      input.reference,
    ) ?? payoutId;

  const requestedFields =
    normalizeFields(
      input.requestedFields,
    );

  const responseUrl =
    normalizeOptional(
      input.responseUrl,
    ) ??
    `${getAppUrl()}/organizer/payouts`;

  const resend =
    getResendClient();

  const subject =
    `Informations requises pour votre retrait Tikemia — ${reference}`;

  const fieldsText =
    requestedFields.length > 0
      ? requestedFields
          .map(
            (field) =>
              `- ${field}`,
          )
          .join("\n")
      : "- Consultez le message de l’administration ci-dessous.";

  const text = [
    `Bonjour ${organizerName},`,
    "",
    "Des informations supplémentaires sont nécessaires avant de traiter votre demande de retrait.",
    `Référence : ${reference}`,
    `Montant : ${formatAmount(amount, currency)}`,
    `Date de la demande : ${formatDate(input.requestedAt)}`,
    "",
    "Message de l’administration :",
    message,
    "",
    "Informations ou documents demandés :",
    fieldsText,
    "",
    `Répondre depuis votre espace organisateur : ${responseUrl}`,
    "",
    `Support Tikemia : ${getSupportEmail()}`,
  ].join("\n");

  const listHtml =
    requestedFields.length > 0
      ? `<ul style="margin:10px 0 0;padding-left:20px;color:#374151;line-height:1.8;">${requestedFields
          .map(
            (field) =>
              `<li>${escapeHtml(field)}</li>`,
          )
          .join("")}</ul>`
      : `<p style="margin:10px 0 0;color:#374151;">Consultez le message de l’administration et transmettez les éléments demandés.</p>`;

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
      <p style="margin:18px 0 6px;font-size:12px;font-weight:800;letter-spacing:1.5px;color:#fbbf24;">INFORMATIONS REQUISES</p>
      <h1 style="margin:0;font-size:28px;line-height:1.2;color:#ffffff;">Votre dossier doit être complété</h1>
      <p style="margin:16px 0 0;color:#cbd5e1;line-height:1.7;">Bonjour ${escapeHtml(organizerName)}, l’administration Tikemia a besoin d’informations supplémentaires avant de poursuivre le traitement de votre retrait.</p>
    </div>

    <div style="background:#ffffff;padding:26px;border-radius:16px;margin-top:14px;border:1px solid #e5e7eb;">
      <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:10px 0;color:#6b7280;">Référence</td><td style="padding:10px 0;text-align:right;font-weight:800;">${escapeHtml(reference)}</td></tr>
        <tr><td style="padding:10px 0;color:#6b7280;">Montant</td><td style="padding:10px 0;text-align:right;font-weight:800;">${escapeHtml(formatAmount(amount, currency))}</td></tr>
        <tr><td style="padding:10px 0;color:#6b7280;">Date de la demande</td><td style="padding:10px 0;text-align:right;font-weight:800;">${escapeHtml(formatDate(input.requestedAt))}</td></tr>
      </table>

      <div style="margin-top:20px;padding:16px;border-radius:12px;background:#fffbeb;border:1px solid #fde68a;color:#92400e;line-height:1.7;">
        <strong>Message de l’administration</strong><br />
        ${escapeHtml(message)}
      </div>

      <div style="margin-top:16px;padding:16px;border-radius:12px;background:#f9fafb;border:1px solid #e5e7eb;">
        <strong style="color:#111827;">Éléments demandés</strong>
        ${listHtml}
      </div>

      <div style="margin-top:22px;text-align:center;">
        <a href="${escapeHtml(responseUrl)}" style="display:inline-block;padding:13px 22px;border-radius:11px;background:#a3e635;color:#061015;text-decoration:none;font-weight:900;">
          Compléter mon dossier
        </a>
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
      "Resend n’a pas pu envoyer l’e-mail de demande d’informations.",
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
