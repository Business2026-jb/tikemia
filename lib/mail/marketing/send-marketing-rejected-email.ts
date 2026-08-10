import "server-only";

import { Resend } from "resend";

export type MarketingEmailResult = Readonly<{
  sent: boolean;
  provider: "RESEND";
  providerMessageId: string | null;
  recipient: string;
}>;

type NoticeTone =
  | "success"
  | "warning"
  | "danger"
  | "info";

type MarketingEmailRow = readonly [
  label: string,
  value: string | null | undefined,
];

type SendMarketingEmailInput = Readonly<{
  to: string;
  subject: string;
  heading: string;
  introduction: string;
  rows: readonly MarketingEmailRow[];
  notice?: string | null;
  noticeTone?: NoticeTone;
  actionLabel?: string | null;
  actionUrl?: string | null;
}>;

function normalizeRequired(
  value: string,
  label: string,
): string {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (!normalized) {
    throw new Error(`${label} est obligatoire.`);
  }

  return normalized;
}

function normalizeOptional(
  value: string | null | undefined,
): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim() ?? "";
  return normalized || null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("RESEND_API_KEY est manquante.");
  }

  return new Resend(apiKey);
}

function getFromAddress(): string {
  return (
    process.env.MARKETING_EMAIL_FROM?.trim() ||
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
  value: Date | string | null | undefined,
): string {
  if (!value) {
    return "Non précisée";
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Non précisée";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone:
      process.env.APP_TIMEZONE?.trim() ||
      "Africa/Porto-Novo",
  }).format(date);
}

function formatAmount(
  value: string | number | null | undefined,
  currency: string,
): string {
  if (value === null || value === undefined || value === "") {
    return "Non précisé";
  }

  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return `${value} ${currency}`;
  }

  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
    }).format(numeric);
  } catch {
    return `${numeric.toLocaleString("fr-FR")} ${currency}`;
  }
}

function formatPriority(value: string): string {
  const labels: Record<string, string> = {
    LOW: "Faible",
    NORMAL: "Normale",
    HIGH: "Élevée",
    URGENT: "Urgente",
  };

  return labels[value] ?? value;
}

async function sendMarketingEmail(
  input: SendMarketingEmailInput,
): Promise<MarketingEmailResult> {
  const recipient = normalizeRequired(
    input.to,
    "L’adresse e-mail du destinataire",
  );

  const supportEmail = getSupportEmail();

  const tones = {
    success: {
      background: "#ecfdf5",
      border: "#a7f3d0",
      text: "#065f46",
    },
    warning: {
      background: "#fffbeb",
      border: "#fde68a",
      text: "#92400e",
    },
    danger: {
      background: "#fef2f2",
      border: "#fecaca",
      text: "#991b1b",
    },
    info: {
      background: "#eff6ff",
      border: "#bfdbfe",
      text: "#1e40af",
    },
  } as const;

  const tone = tones[input.noticeTone ?? "info"];

  const rows = input.rows.filter(
    (row): row is readonly [string, string] =>
      Boolean(row[1]),
  );

  const text = [
    input.heading,
    "",
    input.introduction,
    "",
    ...rows.map(([label, value]) => `${label} : ${value}`),
    input.notice ? `\n${input.notice}` : "",
    input.actionUrl
      ? `\n${input.actionLabel ?? "Ouvrir Tikemia"} : ${input.actionUrl}`
      : "",
    "",
    `Support Tikemia : ${supportEmail}`,
  ].join("\n");

  const tableRows = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:10px 0;color:#6b7280;vertical-align:top;">
            ${escapeHtml(label)}
          </td>
          <td style="padding:10px 0;text-align:right;font-weight:800;color:#111827;vertical-align:top;">
            ${escapeHtml(value)}
          </td>
        </tr>
      `,
    )
    .join("");

  const notice = input.notice
    ? `
      <div style="margin-top:20px;padding:16px;border-radius:12px;background:${tone.background};border:1px solid ${tone.border};color:${tone.text};line-height:1.7;">
        ${escapeHtml(input.notice)}
      </div>
    `
    : "";

  const action = input.actionUrl
    ? `
      <div style="margin-top:22px;text-align:center;">
        <a
          href="${escapeHtml(input.actionUrl)}"
          style="display:inline-block;padding:12px 20px;border-radius:10px;background:#111827;color:#ffffff;text-decoration:none;font-size:14px;font-weight:800;"
        >
          ${escapeHtml(input.actionLabel ?? "Ouvrir Tikemia")}
        </a>
      </div>
    `
    : "";

  const html = `
    <div style="margin:0;background:#f3f4f6;padding:28px 14px;font-family:Arial,sans-serif;color:#111827;">
      <div style="max-width:640px;margin:0 auto;">
        <div style="padding:0 4px 18px;">
          <div style="font-size:24px;font-weight:900;color:#111827;">
            TIKEMIA
          </div>
          <div style="margin-top:5px;color:#6b7280;font-size:13px;">
            Gestion des campagnes marketing
          </div>
        </div>

        <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;padding:26px;">
          <h1 style="margin:0;font-size:21px;line-height:1.4;color:#111827;">
            ${escapeHtml(input.heading)}
          </h1>

          <p style="margin:12px 0 20px;color:#4b5563;line-height:1.7;">
            ${escapeHtml(input.introduction)}
          </p>

          <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;">
            ${tableRows}
          </table>

          ${notice}
          ${action}
        </div>

        <p style="margin:16px 0 0;text-align:center;font-size:12px;color:#6b7280;line-height:1.6;">
          Cet e-mail a été envoyé automatiquement par Tikemia.<br />
          Support : ${escapeHtml(supportEmail)}
        </p>
      </div>
    </div>
  `;

  const result = await getResendClient().emails.send({
    from: getFromAddress(),
    to: [recipient],
    subject: input.subject,
    html,
    text,
    replyTo: supportEmail,
  });

  if (result.error) {
    throw new Error(
      result.error.message ||
        "Resend n’a pas pu envoyer l’e-mail marketing.",
    );
  }

  return {
    sent: true,
    provider: "RESEND",
    providerMessageId: result.data?.id ?? null,
    recipient,
  };
}


export type SendMarketingRejectedEmailInput = Readonly<{
  to: string;
  organizerName: string;
  campaignId: string;
  campaignName: string;
  eventTitle: string;
  reason: string;
}>;

export async function sendMarketingRejectedEmail(
  input: SendMarketingRejectedEmailInput,
): Promise<MarketingEmailResult> {
  const organizerName = normalizeRequired(
    input.organizerName,
    "Le nom de l’organisateur",
  );
  const campaignId = normalizeRequired(
    input.campaignId,
    "L’identifiant de la campagne",
  );
  const campaignName = normalizeRequired(
    input.campaignName,
    "Le nom de la campagne",
  );
  const eventTitle = normalizeRequired(
    input.eventTitle,
    "Le titre de l’événement",
  );
  const reason = normalizeRequired(
    input.reason,
    "Le motif du refus",
  );

  return sendMarketingEmail({
    to: input.to,
    subject: `Campagne marketing refusée — ${campaignName}`,
    heading: `Bonjour ${organizerName}, votre campagne n’a pas été approuvée`,
    introduction:
      "L’administration Tikemia a examiné votre demande et ne peut pas l’approuver dans son état actuel.",
    rows: [
      ["Campagne", campaignName],
      ["Référence", campaignId],
      ["Événement", eventTitle],
    ],
    notice: `Motif du refus : ${reason}`,
    noticeTone: "danger",
    actionLabel: "Consulter mes campagnes",
    actionUrl: `${getAppUrl()}/organizer/marketing`,
  });
}
