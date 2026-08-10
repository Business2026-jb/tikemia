import "server-only";

import { Resend } from "resend";

export type SendCouponExtendedEmailInput = Readonly<{
  to: string;
  organizerName: string;
  couponId: string;
  code: string;
  eventTitle: string;
  previousExpiresAt?: Date | string | null;
  newExpiresAt: Date | string;
  additionalDays?: number | null;
  reactivated?: boolean;
}>;

export type SendCouponExtendedEmailResult = Readonly<{
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

function normalizeAdditionalDays(
  value: number | null | undefined,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (!Number.isInteger(value) || value < 1) {
    return null;
  }

  return value;
}

export async function sendCouponExtendedEmail(
  input: SendCouponExtendedEmailInput,
): Promise<SendCouponExtendedEmailResult> {
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

  const newExpiresAt =
    input.newExpiresAt instanceof Date
      ? input.newExpiresAt
      : new Date(input.newExpiresAt);

  if (Number.isNaN(newExpiresAt.getTime())) {
    throw new Error(
      "La nouvelle date d’expiration est invalide.",
    );
  }

  const additionalDays = normalizeAdditionalDays(
    input.additionalDays,
  );

  const reactivated = Boolean(input.reactivated);
  const supportEmail = getSupportEmail();
  const actionUrl = `${getAppUrl()}/organizer/coupons`;

  const previousExpiration = formatDate(
    input.previousExpiresAt,
  );

  const newExpiration = formatDate(newExpiresAt);

  const additionalDaysLabel =
    additionalDays !== null
      ? `${additionalDays} jour${additionalDays > 1 ? "s" : ""}`
      : null;

  const subject = `Code promo prolongé — ${code}`;

  const notice = reactivated
    ? "Le code promo a également été réactivé et peut de nouveau être utilisé."
    : "Le code promo conserve son statut actuel. Une activation séparée peut être nécessaire s’il est suspendu ou désactivé.";

  const text = [
    `Bonjour ${organizerName},`,
    "",
    "L’administration Tikemia a prolongé la période de validité de votre code promo.",
    "",
    `Événement : ${eventTitle}`,
    `Code promo : ${code}`,
    `Référence : ${couponId}`,
    `Ancienne expiration : ${previousExpiration}`,
    `Nouvelle expiration : ${newExpiration}`,
    additionalDaysLabel
      ? `Durée ajoutée : ${additionalDaysLabel}`
      : null,
    `Réactivation : ${reactivated ? "Oui" : "Non"}`,
    "",
    notice,
    "",
    `Gérer mes codes promo : ${actionUrl}`,
    "",
    `Support Tikemia : ${supportEmail}`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  const reactivationRow = `
    <tr>
      <td
        style="
          padding:10px 0;
          color:#6b7280;
          vertical-align:top;
        "
      >
        Réactivation
      </td>

      <td
        style="
          padding:10px 0;
          text-align:right;
          font-weight:800;
          color:${reactivated ? "#059669" : "#111827"};
          vertical-align:top;
        "
      >
        ${reactivated ? "Oui" : "Non"}
      </td>
    </tr>
  `;

  const additionalDaysRow =
    additionalDaysLabel !== null
      ? `
        <tr>
          <td
            style="
              padding:10px 0;
              color:#6b7280;
              vertical-align:top;
            "
          >
            Durée ajoutée
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
            ${escapeHtml(additionalDaysLabel)}
          </td>
        </tr>
      `
      : "";

  const noticeBackground = reactivated
    ? "#ecfdf5"
    : "#eff6ff";

  const noticeBorder = reactivated
    ? "#a7f3d0"
    : "#bfdbfe";

  const noticeColor = reactivated
    ? "#065f46"
    : "#1e40af";

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
            Code promo prolongé
          </div>

          <h1
            style="
              margin:0;
              font-size:21px;
              line-height:1.4;
              color:#111827;
            "
          >
            Bonjour ${escapeHtml(organizerName)}, votre code promo a été prolongé
          </h1>

          <p
            style="
              margin:14px 0 22px;
              color:#4b5563;
              line-height:1.7;
            "
          >
            L’administration Tikemia a modifié la date d’expiration de votre
            code promo. Les nouvelles informations sont présentées ci-dessous.
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
                  color:#111827;
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

            <tr>
              <td
                style="
                  padding:10px 0;
                  color:#6b7280;
                  vertical-align:top;
                "
              >
                Ancienne expiration
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
                ${escapeHtml(previousExpiration)}
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
                Nouvelle expiration
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
                ${escapeHtml(newExpiration)}
              </td>
            </tr>

            ${additionalDaysRow}
            ${reactivationRow}
          </table>

          <div
            style="
              margin-top:20px;
              padding:16px;
              border-radius:12px;
              background:${noticeBackground};
              border:1px solid ${noticeBorder};
              color:${noticeColor};
              line-height:1.7;
            "
          >
            ${escapeHtml(notice)}
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
        "Resend n’a pas pu envoyer l’e-mail de prolongation du code promo.",
    );
  }

  return {
    sent: true,
    provider: "RESEND",
    providerMessageId: result.data?.id ?? null,
    recipient,
  };
}