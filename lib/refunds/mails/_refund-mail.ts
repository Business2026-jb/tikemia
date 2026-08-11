import "server-only";

import { Resend } from "resend";

import { RefundError } from "@/lib/refunds/errors";

const DEFAULT_FROM = "Tikemia Remboursements <remboursements@tikemia.com>";
const DEFAULT_REPLY_TO = "support@tikemia.com";

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function formatMoney(value: string | number, currency: string): string {
  const amount = typeof value === "number" ? value : Number(value);
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency.trim().toUpperCase(),
    }).format(Number.isFinite(amount) ? amount : 0);
  } catch {
    return `${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"} ${currency}`;
  }
}

export function formatDate(value?: Date | string | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Africa/Porto-Novo",
  }).format(date);
}

export function appUrl(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    "https://tikemia.com";
  try {
    return new URL(path, base).toString();
  } catch {
    return `https://tikemia.com${path}`;
  }
}

export function layout(title: string, content: string): string {
  return `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:#030709;color:#fff;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:28px 14px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:660px;background:#071014;border:1px solid #1f2937;border-radius:22px;overflow:hidden">
<tr><td style="padding:24px 26px;border-bottom:1px solid #1f2937"><strong style="font-size:22px">Tikemia</strong><div style="margin-top:5px;color:#6ee7b7;font-size:11px;font-weight:700;text-transform:uppercase">Remboursements</div></td></tr>
<tr><td style="padding:28px 26px"><h1 style="margin:0 0 18px;font-size:24px">${escapeHtml(title)}</h1>${content}</td></tr>
<tr><td style="padding:20px 26px;border-top:1px solid #1f2937;color:#6b7280;font-size:11px">Message automatique Tikemia. Ne partagez jamais vos mots de passe ou codes de sécurité.</td></tr>
</table></td></tr></table></body></html>`;
}

export async function sendRefundMail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ sent: true; id: string | null }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    throw new RefundError({
      code: "REFUND_EMAIL_CONFIGURATION_ERROR",
      message: "La clé RESEND_API_KEY est absente.",
      status: 500,
    });
  }

  const resend = new Resend(apiKey);

  try {
    const result = await resend.emails.send({
      from: process.env.MAIL_FROM_REFUNDS?.trim() || DEFAULT_FROM,
      to: [to.trim().toLowerCase()],
      replyTo:
        process.env.MAIL_REPLY_TO_SUPPORT?.trim() ||
        DEFAULT_REPLY_TO,
      subject,
      html,
      text,
    });

    if (result.error) {
      throw result.error;
    }

    return { sent: true, id: result.data?.id ?? null };
  } catch (cause) {
    throw new RefundError({
      code: "REFUND_EMAIL_SEND_FAILED",
      message: "L’e-mail de remboursement n’a pas pu être envoyé.",
      status: 502,
      retryable: true,
      cause,
    });
  }
}
