import "server-only";

import {
  Resend,
} from "resend";

export type SendSubscriptionPlanChangedEmailInput =
  Readonly<{
    to: string;
    organizerName: string;
    subscriptionId: string;
    previousPlanName: string;
    newPlanName: string;
    newPrice: string;
    currency: string;
    startsAt?: Date | string | null;
    endsAt?: Date | string | null;
  }>;

export type SendSubscriptionPlanChangedEmailResult =
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
    process.env.SUBSCRIPTION_EMAIL_FROM?.trim() ||
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

function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    "https://tikemia.com"
  ).replace(/\/+$/, "");
}

export async function sendSubscriptionPlanChangedEmail(
  input: SendSubscriptionPlanChangedEmailInput,
): Promise<SendSubscriptionPlanChangedEmailResult> {
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

  const subscriptionId =
    normalizeRequired(
      input.subscriptionId,
      "L’identifiant de l’abonnement",
    );

  const previousPlanName =
    normalizeRequired(
      input.previousPlanName,
      "L’ancien plan",
    );

  const newPlanName =
    normalizeRequired(
      input.newPlanName,
      "Le nouveau plan",
    );

  const newPrice =
    normalizeRequired(
      input.newPrice,
      "Le nouveau prix",
    );

  const currency =
    normalizeRequired(
      input.currency,
      "La devise",
    ).toUpperCase();

  const subject =
    `Votre plan Tikemia a été modifié — ${newPlanName}`;

  const text = [
    `Bonjour ${organizerName},`,
    "",
    "Votre plan d’abonnement Tikemia a été modifié.",
    `Ancien plan : ${previousPlanName}`,
    `Nouveau plan : ${newPlanName}`,
    `Nouveau prix : ${formatAmount(newPrice, currency)}`,
    `Début : ${formatDate(input.startsAt)}`,
    `Fin : ${formatDate(input.endsAt)}`,
    `Référence : ${subscriptionId}`,
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
      <p style="margin:18px 0 6px;font-size:12px;font-weight:800;letter-spacing:1.5px;color:#60a5fa;">PLAN MODIFIÉ</p>
      <h1 style="margin:0;font-size:28px;line-height:1.2;color:#ffffff;">Votre abonnement a été mis à jour</h1>
      <p style="margin:16px 0 0;color:#cbd5e1;line-height:1.7;">Bonjour ${escapeHtml(organizerName)}, votre plan d’abonnement a été modifié par l’administration Tikemia.</p>
    </div>

    <div style="background:#ffffff;padding:26px;border-radius:16px;margin-top:14px;border:1px solid #e5e7eb;">
      <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:10px 0;color:#6b7280;">Ancien plan</td><td style="padding:10px 0;text-align:right;font-weight:800;">${escapeHtml(previousPlanName)}</td></tr>
        <tr><td style="padding:10px 0;color:#6b7280;">Nouveau plan</td><td style="padding:10px 0;text-align:right;font-weight:900;color:#059669;">${escapeHtml(newPlanName)}</td></tr>
        <tr><td style="padding:10px 0;color:#6b7280;">Nouveau prix</td><td style="padding:10px 0;text-align:right;font-weight:800;">${escapeHtml(formatAmount(newPrice, currency))}</td></tr>
        <tr><td style="padding:10px 0;color:#6b7280;">Début</td><td style="padding:10px 0;text-align:right;font-weight:800;">${escapeHtml(formatDate(input.startsAt))}</td></tr>
        <tr><td style="padding:10px 0;color:#6b7280;">Fin</td><td style="padding:10px 0;text-align:right;font-weight:800;">${escapeHtml(formatDate(input.endsAt))}</td></tr>
      </table>
    </div>

    <p style="margin:18px 0 0;text-align:center;font-size:12px;color:#6b7280;">
      Support : ${escapeHtml(getSupportEmail())}
    </p>
  </div>
</body>
</html>`;

  const result =
    await getResendClient().emails.send({
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
      "Resend n’a pas pu envoyer l’e-mail de changement de plan.",
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
