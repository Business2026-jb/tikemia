import "server-only";

import type {
  RefundEmailCustomer,
  RefundEmailEvent,
  RefundEmailRequest,
} from "@/lib/refunds/types";
import {
  appUrl,
  escapeHtml,
  formatDate,
  formatMoney,
  layout,
  sendRefundMail,
} from "@/lib/refunds/mails/_refund-mail";

export async function sendRefundForwardedEmail({
  customer,
  event,
  refund,
}: {
  customer: RefundEmailCustomer;
  event: RefundEmailEvent;
  refund: RefundEmailRequest;
}): Promise<{ sent: true; id: string | null }> {
  const url = appUrl("/account/refunds");
  const date = formatDate(refund.requestedAt);
  const rejectionBlock = "";

  const summary = `
    <p style="margin:0;color:#cbd5e1;line-height:1.7">L’organisateur a transmis votre demande à l’administration Tikemia pour analyse.</p>
    <div style="margin-top:20px;padding:18px;border:1px solid #1f2937;border-radius:16px;background:#050b0f">
      <div style="margin-bottom:8px"><strong>Référence :</strong> ${escapeHtml(refund.reference)}</div>
      <div style="margin-bottom:8px"><strong>Événement :</strong> ${escapeHtml(event.title)}</div>
      <div style="margin-bottom:8px"><strong>Montant :</strong> ${escapeHtml(formatMoney(refund.amount, refund.currency))}</div>
      ${date ? `<div><strong>Date :</strong> ${escapeHtml(date)}</div>` : ""}
    </div>
    ${rejectionBlock}
    <p style="margin:22px 0 0"><a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 18px;border-radius:12px;background:#10b981;color:#00120c;text-decoration:none;font-weight:800">Voir la demande</a></p>
  `;

  return sendRefundMail({
    to: customer.email,
    subject: `Demande transmise à Tikemia — ${refund.reference}`,
    html: layout("Demande transmise à Tikemia", summary),
    text: [
      `Bonjour ${customer.name},`,
      "",
      "L’organisateur a transmis votre demande à l’administration Tikemia pour analyse.",
      `Référence : ${refund.reference}`,
      `Événement : ${event.title}`,
      `Montant : ${formatMoney(refund.amount, refund.currency)}`,
      date ? `Date : ${date}` : "",
      "",
      url,
      "",
      "Tikemia",
    ].filter(Boolean).join("\n"),
  });
}
