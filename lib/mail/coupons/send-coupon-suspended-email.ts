import "server-only";

import { Resend } from "resend";

export type SendCouponSuspendedEmailInput = Readonly<{
  to: string;
  organizerName: string;
  couponId: string;
  code: string;
  eventTitle: string;
  reason: string;
}>;

export type SendCouponSuspendedEmailResult = Readonly<{
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

export async function sendCouponSuspendedEmail(
  input: SendCouponSuspendedEmailInput,
): Promise<SendCouponSuspendedEmailResult> {
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

  const reason = normalizeRequired(
    input.reason,
    "Le motif de suspension",
  );

  const supportEmail = getSupportEmail();
  const actionUrl = `${getAppUrl()}/organizer/coupons`;

  const subject = `Code promo suspendu — ${code}`;

  const text = [
    `Bonjour ${organizerName},`,
    "",
    "L’administration Tikemia a suspendu temporairement votre code promo.",
    "Il ne peut plus être utilisé tant qu’il n’a pas été réactivé.",
    "",
    `Événement : ${eventTitle}`,
    `Code promo : ${code}`,
    `Référence : ${couponId}`,
    `Motif de suspension : ${reason}`,
    "",
    `Consulter mes codes promo : ${actionUrl}`,
    "",
    `Support Tikemia : ${supportEmail}`,
  ].join("\n");

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
              background:#fffbeb;
              border:1px solid #fde68a;
              color:#92400e;
              font-size:12px;
              font-weight:800;
            "
          >
            Code promo suspendu
          </div>

          <h1
            style="
              margin:0;
              font-size:21px;
              line-height:1.4;
              color:#111827;
            "
          >
            Bonjour ${escapeHtml(organizerName)}, votre code promo a été suspendu
          </h1>

          <p
            style="
              margin:14px 0 22px;
              color:#4b5563;
              line-height:1.7;
            "
          >
            L’administration Tikemia a suspendu temporairement ce code promo.
            Il ne peut plus être utilisé tant qu’il n’a pas été réactivé.
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
          </table>

          <div
            style="
              margin-top:20px;
              padding:16px;
              border-radius:12px;
              background:#fffbeb;
              border:1px solid #fde68a;
              color:#92400e;
              line-height:1.7;
            "
          >
            <strong>Motif de suspension</strong>
            <br />
            ${escapeHtml(reason)}
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
              Consulter mes codes promo
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
        "Resend n’a pas pu envoyer l’e-mail de suspension du code promo.",
    );
  }

  return {
    sent: true,
    provider: "RESEND",
    providerMessageId: result.data?.id ?? null,
    recipient,
  };
}