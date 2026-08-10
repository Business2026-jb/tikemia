import "server-only";

import { Resend } from "resend";

export type SendCouponUpdatedEmailInput = Readonly<{
  to: string;
  organizerName: string;
  couponId: string;
  code: string;
  eventTitle: string;
  discountType: string;
  discountValue: string | number;
  currency: string;
  minimumOrderAmount?: string | number | null;
  maximumDiscount?: string | number | null;
  maximumUses?: number | null;
  usesPerCustomer?: number | null;
  startsAt?: Date | string | null;
  expiresAt?: Date | string | null;
}>;

export type SendCouponUpdatedEmailResult = Readonly<{
  sent: boolean;
  provider: "RESEND";
  providerMessageId: string | null;
  recipient: string;
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
    process.env.COUPON_EMAIL_FROM?.trim() ||
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
  value: string | number,
  currency: string,
): string {
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

function formatDiscount(
  discountType: string,
  discountValue: string | number,
  currency: string,
): string {
  if (discountType === "PERCENTAGE") {
    const numeric = Number(discountValue);

    if (!Number.isFinite(numeric)) {
      return `${discountValue} %`;
    }

    return `${numeric.toLocaleString("fr-FR", {
      maximumFractionDigits: 2,
    })} %`;
  }

  return formatAmount(discountValue, currency);
}

export async function sendCouponUpdatedEmail(
  input: SendCouponUpdatedEmailInput,
): Promise<SendCouponUpdatedEmailResult> {
  const recipient = normalizeRequired(
    input.to,
    "L’adresse e-mail du destinataire",
  );

  const organizerName = normalizeRequired(
    input.organizerName,
    "Le nom de l’organisateur",
  );

  const couponId = normalizeRequired(
    input.couponId,
    "L’identifiant du code promo",
  );

  const code = normalizeRequired(
    input.code,
    "Le code promo",
  );

  const eventTitle = normalizeRequired(
    input.eventTitle,
    "Le titre de l’événement",
  );

  const discountType = normalizeRequired(
    input.discountType,
    "Le type de réduction",
  );

  const currency = normalizeRequired(
    input.currency,
    "La devise",
  ).toUpperCase();

  const supportEmail = getSupportEmail();
  const actionUrl = `${getAppUrl()}/organizer/coupons`;

  const formattedDiscount = formatDiscount(
    discountType,
    input.discountValue,
    currency,
  );

  const formattedMinimumOrderAmount =
    input.minimumOrderAmount !== null &&
    input.minimumOrderAmount !== undefined
      ? formatAmount(
          input.minimumOrderAmount,
          currency,
        )
      : "Aucun minimum";

  const formattedMaximumDiscount =
    input.maximumDiscount !== null &&
    input.maximumDiscount !== undefined
      ? formatAmount(
          input.maximumDiscount,
          currency,
        )
      : "Aucun plafond";

  const formattedMaximumUses =
    input.maximumUses !== null &&
    input.maximumUses !== undefined
      ? String(input.maximumUses)
      : "Illimitée";

  const formattedUsesPerCustomer =
    input.usesPerCustomer !== null &&
    input.usesPerCustomer !== undefined
      ? String(input.usesPerCustomer)
      : "Non limitée";

  const formattedStartsAt = formatDate(input.startsAt);
  const formattedExpiresAt = formatDate(input.expiresAt);

  const subject = `Code promo mis à jour — ${code}`;

  const text = [
    `Bonjour ${organizerName},`,
    "",
    "L’administration Tikemia a modifié les paramètres de votre code promo.",
    "",
    `Événement : ${eventTitle}`,
    `Code promo : ${code}`,
    `Référence : ${couponId}`,
    `Réduction : ${formattedDiscount}`,
    `Montant minimum : ${formattedMinimumOrderAmount}`,
    `Plafond de réduction : ${formattedMaximumDiscount}`,
    `Limite totale : ${formattedMaximumUses}`,
    `Limite par client : ${formattedUsesPerCustomer}`,
    `Début : ${formattedStartsAt}`,
    `Expiration : ${formattedExpiresAt}`,
    "",
    "Les nouvelles règles sont désormais appliquées aux prochaines utilisations du code promo.",
    "",
    `Gérer mes codes promo : ${actionUrl}`,
    "",
    `Support Tikemia : ${supportEmail}`,
  ].join("\n");

  const html = `
    <div style="margin:0;background:#f3f4f6;padding:28px 14px;font-family:Arial,sans-serif;color:#111827;">
      <div style="max-width:640px;margin:0 auto;">
        <div style="padding:0 4px 18px;">
          <div style="font-size:24px;font-weight:900;color:#111827;">
            TIKEMIA
          </div>

          <div style="margin-top:5px;color:#6b7280;font-size:13px;">
            Gestion des codes promo
          </div>
        </div>

        <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;padding:26px;">
          <h1 style="margin:0;font-size:21px;line-height:1.35;color:#111827;">
            Bonjour ${escapeHtml(organizerName)}, votre code promo a été mis à jour
          </h1>

          <p style="margin:12px 0 20px;color:#4b5563;line-height:1.7;">
            L’administration Tikemia a modifié les paramètres de votre code promo.
            Voici les nouvelles informations appliquées.
          </p>

          <table
            role="presentation"
            style="width:100%;border-collapse:collapse;font-size:14px;"
          >
            <tr>
              <td style="padding:10px 0;color:#6b7280;">
                Événement
              </td>
              <td style="padding:10px 0;text-align:right;font-weight:800;color:#111827;">
                ${escapeHtml(eventTitle)}
              </td>
            </tr>

            <tr>
              <td style="padding:10px 0;color:#6b7280;">
                Code promo
              </td>
              <td style="padding:10px 0;text-align:right;font-weight:900;color:#111827;">
                ${escapeHtml(code)}
              </td>
            </tr>

            <tr>
              <td style="padding:10px 0;color:#6b7280;">
                Référence
              </td>
              <td style="padding:10px 0;text-align:right;font-weight:800;color:#111827;">
                ${escapeHtml(couponId)}
              </td>
            </tr>

            <tr>
              <td style="padding:10px 0;color:#6b7280;">
                Réduction
              </td>
              <td style="padding:10px 0;text-align:right;font-weight:900;color:#059669;">
                ${escapeHtml(formattedDiscount)}
              </td>
            </tr>

            <tr>
              <td style="padding:10px 0;color:#6b7280;">
                Montant minimum
              </td>
              <td style="padding:10px 0;text-align:right;font-weight:800;color:#111827;">
                ${escapeHtml(formattedMinimumOrderAmount)}
              </td>
            </tr>

            <tr>
              <td style="padding:10px 0;color:#6b7280;">
                Plafond de réduction
              </td>
              <td style="padding:10px 0;text-align:right;font-weight:800;color:#111827;">
                ${escapeHtml(formattedMaximumDiscount)}
              </td>
            </tr>

            <tr>
              <td style="padding:10px 0;color:#6b7280;">
                Limite totale
              </td>
              <td style="padding:10px 0;text-align:right;font-weight:800;color:#111827;">
                ${escapeHtml(formattedMaximumUses)}
              </td>
            </tr>

            <tr>
              <td style="padding:10px 0;color:#6b7280;">
                Limite par client
              </td>
              <td style="padding:10px 0;text-align:right;font-weight:800;color:#111827;">
                ${escapeHtml(formattedUsesPerCustomer)}
              </td>
            </tr>

            <tr>
              <td style="padding:10px 0;color:#6b7280;">
                Début
              </td>
              <td style="padding:10px 0;text-align:right;font-weight:800;color:#111827;">
                ${escapeHtml(formattedStartsAt)}
              </td>
            </tr>

            <tr>
              <td style="padding:10px 0;color:#6b7280;">
                Expiration
              </td>
              <td style="padding:10px 0;text-align:right;font-weight:800;color:#111827;">
                ${escapeHtml(formattedExpiresAt)}
              </td>
            </tr>
          </table>

          <div style="margin-top:20px;padding:16px;border-radius:12px;background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;line-height:1.7;">
            Les nouvelles règles sont désormais appliquées aux prochaines
            utilisations du code promo.
          </div>

          <div style="margin-top:22px;text-align:center;">
            <a
              href="${escapeHtml(actionUrl)}"
              style="display:inline-block;padding:12px 20px;border-radius:10px;background:#111827;color:#ffffff;text-decoration:none;font-size:14px;font-weight:800;"
            >
              Gérer mes codes promo
            </a>
          </div>
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
    subject,
    html,
    text,
    replyTo: supportEmail,
  });

  if (result.error) {
    throw new Error(
      result.error.message ||
        "Resend n’a pas pu envoyer l’e-mail de mise à jour du code promo.",
    );
  }

  return {
    sent: true,
    provider: "RESEND",
    providerMessageId: result.data?.id ?? null,
    recipient,
  };
}