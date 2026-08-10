import "server-only";

import {
  Resend,
} from "resend";

export type SendPayoutRejectedEmailInput =
  Readonly<{
    to: string;
    organizerName: string;
    payoutId: string;
    reference?: string | null;
    amount: string;
    currency: string;
    reason: string;
    processedAt?: Date | string | null;
    supportMessage?: string | null;
  }>;

export type SendPayoutRejectedEmailResult =
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

export async function sendPayoutRejectedEmail(
  input: SendPayoutRejectedEmailInput,
): Promise<SendPayoutRejectedEmailResult> {
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

  const reason =
    normalizeRequired(
      input.reason,
      "Le motif du refus",
    );

  const reference =
    normalizeOptional(
      input.reference,
    ) ?? payoutId;

  const supportMessage =
    normalizeOptional(
      input.supportMessage,
    ) ??
    "Vous pouvez corriger les informations concernées puis contacter le support Tikemia.";

  const resend =
    getResendClient();

  const subject =
    `Votre demande de retrait Tikemia a été refusée — ${reference}`;

  const text = [
    `Bonjour ${organizerName},`,
    "",
    "Votre demande de retrait Tikemia n’a pas été approuvée.",
    `Référence : ${reference}`,
    `Montant : ${formatAmount(amount, currency)}`,
    `Date de décision : ${formatDate(input.processedAt)}`,
    `Motif : ${reason}`,
    "",
    supportMessage,
    "",
    `Support Tikemia : ${getSupportEmail()}`,
  ].join("\n");

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
      <p style="margin:18px 0 6px;font-size:12px;font-weight:800;letter-spacing:1.5px;color:#f87171;">RETRAIT REFUSÉ</p>
      <h1 style="margin:0;font-size:28px;line-height:1.2;color:#ffffff;">Votre demande n’a pas été approuvée</h1>
      <p style="margin:16px 0 0;color:#cbd5e1;line-height:1.7;">Bonjour ${escapeHtml(organizerName)}, l’administration Tikemia a terminé l’examen de votre demande.</p>
    </div>

    <div style="background:#ffffff;padding:26px;border-radius:16px;margin-top:14px;border:1px solid #e5e7eb;">
      <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:10px 0;color:#6b7280;">Référence</td><td style="padding:10px 0;text-align:right;font-weight:800;">${escapeHtml(reference)}</td></tr>
        <tr><td style="padding:10px 0;color:#6b7280;">Montant</td><td style="padding:10px 0;text-align:right;font-weight:800;">${escapeHtml(formatAmount(amount, currency))}</td></tr>
        <tr><td style="padding:10px 0;color:#6b7280;">Date de décision</td><td style="padding:10px 0;text-align:right;font-weight:800;">${escapeHtml(formatDate(input.processedAt))}</td></tr>
      </table>

      <div style="margin-top:20px;padding:16px;border-radius:12px;background:#fef2f2;border:1px solid #fecaca;color:#991b1b;line-height:1.7;">
        <strong>Motif du refus</strong><br />
        ${escapeHtml(reason)}
      </div>

      <div style="margin-top:14px;padding:16px;border-radius:12px;background:#f9fafb;border:1px solid #e5e7eb;color:#374151;line-height:1.7;">
        ${escapeHtml(supportMessage)}
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
      "Resend n’a pas pu envoyer l’e-mail de refus du retrait.",
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
