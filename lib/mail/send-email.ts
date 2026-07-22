import "server-only";

import { resend } from "@/lib/mail/resend";
import type { MailCategory } from "@/lib/mail/types";

const senders: Record<MailCategory, string | undefined> = {
  verification: process.env.MAIL_FROM_VERIFICATION,
  tickets: process.env.MAIL_FROM_TICKETS,
  payments: process.env.MAIL_FROM_PAYMENTS,
  organizers: process.env.MAIL_FROM_ORGANIZERS,
  security: process.env.MAIL_FROM_SECURITY,
  support: process.env.MAIL_FROM_SUPPORT,
};

type SendEmailParams = {
  category: MailCategory;
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  idempotencyKey?: string;
};

export async function sendEmail({
  category,
  to,
  subject,
  html,
  text,
  replyTo,
  idempotencyKey,
}: SendEmailParams) {
  const from = senders[category]?.trim();

  if (!from) {
    throw new Error(
      `L’adresse d’envoi de la catégorie "${category}" est absente.`,
    );
  }

  const recipients = Array.isArray(to)
    ? to.map((email) => email.trim()).filter(Boolean)
    : [to.trim()].filter(Boolean);

  if (recipients.length === 0) {
    throw new Error("Aucun destinataire valide n’a été renseigné.");
  }

  const { data, error } = await resend.emails.send(
    {
      from,
      to: recipients,
      subject: subject.trim(),
      html,
      text,
      replyTo: replyTo?.trim() || undefined,
    },
    idempotencyKey
      ? {
          idempotencyKey,
        }
      : undefined,
  );

  if (error) {
    console.error("[RESEND_SEND_ERROR]", {
      name: error.name,
      message: error.message,
    });

    throw new Error(
      `Échec de l’envoi de l’e-mail : ${error.message}`,
    );
  }

  if (!data?.id) {
    throw new Error(
      "Resend n’a pas retourné l’identifiant de l’e-mail envoyé.",
    );
  }

  return data;
}