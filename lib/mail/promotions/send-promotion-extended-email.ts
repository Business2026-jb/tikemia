import "server-only";

import { Resend } from "resend";

type MailResult = Readonly<{
  sent: boolean;
  provider: "RESEND";
  providerMessageId: string | null;
  recipient: string;
}>;

function required(value: string, label: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) throw new Error(`${label} est obligatoire.`);
  return normalized;
}

function optional(value?: string | null): string | null {
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

function resendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new Error("RESEND_API_KEY est manquante.");
  return new Resend(apiKey);
}

function fromAddress(): string {
  return (
    process.env.PROMOTION_EMAIL_FROM?.trim() ||
    process.env.MAIL_FROM?.trim() ||
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "Tikemia <noreply@tikemia.com>"
  );
}

function supportEmail(): string {
  return process.env.SUPPORT_EMAIL?.trim() || "support@tikemia.com";
}

function formatDate(value?: Date | string | null): string {
  if (!value) return "Non précisée";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Non précisée";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: process.env.APP_TIMEZONE?.trim() || "Africa/Porto-Novo",
  }).format(date);
}

async function sendMail(input: {
  to: string;
  subject: string;
  heading: string;
  intro: string;
  rows: Array<[string, string | null | undefined]>;
  notice?: string | null;
  noticeTone?: "success" | "danger" | "warning" | "info";
}): Promise<MailResult> {
  const recipient = required(input.to, "L’adresse e-mail du destinataire");
  const tones = {
    success: ["#ecfdf5", "#a7f3d0", "#065f46"],
    danger: ["#fef2f2", "#fecaca", "#991b1b"],
    warning: ["#fffbeb", "#fde68a", "#92400e"],
    info: ["#eff6ff", "#bfdbfe", "#1e40af"],
  } as const;
  const tone = tones[input.noticeTone ?? "info"];

  const rows = input.rows.filter((row): row is [string, string] => Boolean(row[1]));
  const text = [
    input.heading,
    "",
    input.intro,
    "",
    ...rows.map(([label, value]) => `${label} : ${value}`),
    input.notice ? `\n${input.notice}` : "",
    "",
    `Support Tikemia : ${supportEmail()}`,
  ].join("\n");

  const table = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:9px 0;color:#6b7280;">${escapeHtml(label)}</td><td style="padding:9px 0;text-align:right;font-weight:700;color:#111827;">${escapeHtml(value)}</td></tr>`,
    )
    .join("");

  const notice = input.notice
    ? `<div style="margin-top:18px;padding:15px;border-radius:12px;background:${tone[0]};border:1px solid ${tone[1]};color:${tone[2]};line-height:1.65;">${escapeHtml(input.notice)}</div>`
    : "";

  const html = `
<div style="margin:0;background:#f5f7fa;padding:28px 14px;font-family:Arial,sans-serif;color:#111827;">
  <div style="max-width:620px;margin:0 auto;">
    <div style="padding:0 4px 18px;">
      <div style="font-size:24px;font-weight:900;">TIKEMIA</div>
      <div style="margin-top:5px;color:#6b7280;font-size:13px;">Gestion des promotions d’événements</div>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:26px;">
      <h1 style="margin:0;font-size:21px;">${escapeHtml(input.heading)}</h1>
      <p style="margin:12px 0 20px;color:#4b5563;line-height:1.65;">${escapeHtml(input.intro)}</p>
      <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;">${table}</table>
      ${notice}
    </div>
    <p style="margin:16px 0 0;text-align:center;font-size:12px;color:#6b7280;">
      E-mail automatique Tikemia · Support : ${escapeHtml(supportEmail())}
    </p>
  </div>
</div>`;

  const result = await resendClient().emails.send({
    from: fromAddress(),
    to: [recipient],
    subject: input.subject,
    html,
    text,
    replyTo: supportEmail(),
  });

  if (result.error) {
    throw new Error(result.error.message || "Impossible d’envoyer l’e-mail de promotion.");
  }

  return {
    sent: true,
    provider: "RESEND",
    providerMessageId: result.data?.id ?? null,
    recipient,
  };
}

export type SendPromotionExtendedEmailInput = Readonly<{
  to: string;
  organizerName: string;
  eventTitle: string;
  promotionId: string;
  previousEndsAt?: Date | string | null;
  newEndsAt: Date | string;
}>;

export async function sendPromotionExtendedEmail(
  input: SendPromotionExtendedEmailInput,
): Promise<MailResult> {
  const organizerName = required(input.organizerName, "Le nom de l’organisateur");
  const eventTitle = required(input.eventTitle, "Le titre de l’événement");
  const promotionId = required(input.promotionId, "L’identifiant de la promotion");

  return sendMail({
    to: input.to,
    subject: `Promotion prolongée — ${eventTitle}`,
    heading: `Bonjour ${organizerName}, votre promotion a été prolongée`,
    intro: "La période de mise en avant de votre événement a été modifiée.",
    rows: [
      ["Événement", eventTitle],
      ["Référence", promotionId],
      ["Ancienne fin", formatDate(input.previousEndsAt)],
      ["Nouvelle fin", formatDate(input.newEndsAt)],
    ],
    notice: "La mise en avant restera applicable jusqu’à la nouvelle date de fin, sous réserve du statut de la promotion.",
    noticeTone: "success",
  });
}
