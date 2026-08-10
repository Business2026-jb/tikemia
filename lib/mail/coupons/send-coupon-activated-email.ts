import "server-only";

import { Resend } from "resend";

export type SendCouponActivatedEmailInput = Readonly<{
  to: string;
  organizerName: string;
  couponId: string;
  code: string;
  eventTitle: string;
  startsAt?: Date | string | null;
  expiresAt?: Date | string | null;
  discountType?: string | null;
  discountValue?: string | number | null;
  currency?: string | null;
}>;

export type SendCouponActivatedEmailResult = Readonly<{
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

export async function sendCouponActivatedEmail(
  input: SendCouponActivatedEmailInput,
): Promise<SendCouponActivatedEmailResult> {
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

  const discountType = normalizeOptional(
    input.discountType,
  );

  const currency =
    normalizeOptional(input.currency)?.toUpperCase() ||
    "XOF";

  const discount =
    discountType &&
    input.discountValue !== null &&
    input.discountValue !== undefined
      ? formatDiscount(
          discountType,
          input.discountValue,
          currency,
        )
      : null;

  const supportEmail = getSupportEmail();
  const actionUrl = `${getAppUrl()}/organizer/coupons`;

  const formattedStartsAt = formatDate(input.startsAt);
  const formattedExpiresAt = formatDate(input.expiresAt);

  const subject = `Code promo activé — ${code}`;

  const text = [
    `Bonjour ${organizerName},`,
    "",
    "L’administration Tikemia a activé votre code promo.",
    "Il peut désormais être utilisé selon la période et les limites configurées.",
    "",
    `Événement : ${eventTitle}`,
    `Code promo : ${code}`,
    `Référence : ${couponId}`,
    discount ? `Réduction : ${discount}` : null,
    `Début : ${formattedStartsAt}`,
    `Expiration : ${formattedExpiresAt}`,
    "",
    "Le code promo sera automatiquement refusé lorsqu’il aura expiré ou atteint sa limite d’utilisation.",
    "",
    `Gérer mes codes promo : ${actionUrl}`,
    "",
    `Support Tikemia : ${supportEmail}`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  const discountRow = discount
    ? `
      <tr>
        <td
          style="
            padding:10px 0;
            color:#6b7280;
            vertical-align:top;
          "
        >
          Réduction
        </td>

        <td
          style="
            padding:10px 0;
            text-align:right;
            font-weight:900;
            color:#059669;
            vertical-align:top;
          "
        >
          ${escapeHtml(discount)}
        </td>
      </tr>
    `
    : "";

  const html = `
    <div
      style="
        margin:0;
        background:#f3f4f6;
        padding:28px 14px;
        font-family:Arial,sans-serif;
        color:#111827;
      "
    >
      <div style="max-width:640px;margin:0 auto;">
        <div style="padding:0 4px 18px;">
          <div
            style="
              font-size:24px;
              font-weight:900;
              color:#111827;
            "
          >
            TIKEMIA
          </div>

          <div
            style="
              margin-top:5px;
              color:#6b7280;
              font-size:13px;
            "
          >
            Gestion des codes promo
          </div>
        </div>

        <div
          style="
            background:#ffffff;
            border:1px solid #e5e7eb;
            border-radius:18px;
            padding:26px;
          "
        >
          <div
            style="
              display:inline-block;
              margin-bottom:18px;
              padding:7px 12px;
              border-radius:999px;
              background:#ecfdf5;
              border:1px solid #a7f3d0;
              color:#065f46;
              font-size:12px;
              font-weight:800;
            "
          >
            Code promo activé
          </div>

          <h1
            style="
              margin:0;
              font-size:21px;
              line-height:1.4;
              color:#111827;
            "
          >
            Bonjour ${escapeHtml(organizerName)}, votre code promo est activé
          </h1>

          <p
            style="
              margin:14px 0 22px;
              color:#4b5563;
              line-height:1.7;
            "
          >
            L’administration Tikemia a activé votre code promo.
            Il peut désormais être utilisé selon la période et les limites
            configurées.
          </p>

          <table
            role="presentation"
            style="
              width:100%;
              border-collapse:collapse;
              font-size:14px;
            "
          >
            <tr>
              <td
                style="
                  padding:10px 0;
                  color:#6b7280;
                  vertical-align:top;
                "
              >
                Événement
              </td>

              <td
                style="
                  padding:10px 0;
                  text-align:right;
                  font-weight:800;
                  color:#111827;
                  vertical-align:top;
                "
              >
                ${escapeHtml(eventTitle)}
              </td>
            </tr>

            <tr>
              <td
                style="
                  padding:10px 0;
                  color:#6b7280;
                  vertical-align:top;
                "
              >
                Code promo
              </td>

              <td
                style="
                  padding:10px 0;
                  text-align:right;
                  font-weight:900;
                  color:#059669;
                  vertical-align:top;
                "
              >
                ${escapeHtml(code)}
              </td>
            </tr>

            <tr>
              <td
                style="
                  padding:10px 0;
                  color:#6b7280;
                  vertical-align:top;
                "
              >
                Référence
              </td>

              <td
                style="
                  padding:10px 0;
                  text-align:right;
                  font-weight:800;
                  color:#111827;
                  vertical-align:top;
                "
              >
                ${escapeHtml(couponId)}
              </td>
            </tr>

            ${discountRow}

            <tr>
              <td
                style="
                  padding:10px 0;
                  color:#6b7280;
                  vertical-align:top;
                "
              >
                Début
              </td>

              <td
                style="
                  padding:10px 0;
                  text-align:right;
                  font-weight:800;
                  color:#111827;
                  vertical-align:top;
                "
              >
                ${escapeHtml(formattedStartsAt)}
              </td>
            </tr>

            <tr>
              <td
                style="
                  padding:10px 0;
                  color:#6b7280;
                  vertical-align:top;
                "
              >
                Expiration
              </td>

              <td
                style="
                  padding:10px 0;
                  text-align:right;
                  font-weight:800;
                  color:#111827;
                  vertical-align:top;
                "
              >
                ${escapeHtml(formattedExpiresAt)}
              </td>
            </tr>

            <tr>
              <td
                style="
                  padding:10px 0;
                  color:#6b7280;
                  vertical-align:top;
                "
              >
                Statut
              </td>

              <td
                style="
                  padding:10px 0;
                  text-align:right;
                  font-weight:900;
                  color:#059669;
                  vertical-align:top;
                "
              >
                Actif
              </td>
            </tr>
          </table>

          <div
            style="
              margin-top:20px;
              padding:16px;
              border-radius:12px;
              background:#ecfdf5;
              border:1px solid #a7f3d0;
              color:#065f46;
              line-height:1.7;
            "
          >
            Le code promo sera automatiquement refusé lorsqu’il aura expiré
            ou atteint sa limite d’utilisation.
          </div>

          <div
            style="
              margin-top:22px;
              text-align:center;
            "
          >
            <a
              href="${escapeHtml(actionUrl)}"
              style="
                display:inline-block;
                padding:12px 20px;
                border-radius:10px;
                background:#111827;
                color:#ffffff;
                text-decoration:none;
                font-size:14px;
                font-weight:800;
              "
            >
              Gérer mes codes promo
            </a>
          </div>
        </div>

        <p
          style="
            margin:16px 0 0;
            text-align:center;
            font-size:12px;
            color:#6b7280;
            line-height:1.6;
          "
        >
          Cet e-mail a été envoyé automatiquement par Tikemia.
          <br />
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
        "Resend n’a pas pu envoyer l’e-mail d’activation du code promo.",
    );
  }

  return {
    sent: true,
    provider: "RESEND",
    providerMessageId: result.data?.id ?? null,
    recipient,
  };
}