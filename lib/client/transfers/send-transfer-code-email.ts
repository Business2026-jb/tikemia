import { Resend } from "resend";

type SendTransferCodeEmailParams = {
  to: string;
  firstName: string;
  code: string;
  expiresInMinutes: number;
  transferReference: string;
  recipientName: string;
  ticketsCount: number;
};

type SendTransferCodeEmailResult =
  | {
      success: true;
      messageId: string | null;
    }
  | {
      success: false;
      messageId: null;
      error: string;
    };

const APP_NAME =
  process.env.APP_NAME?.trim() ||
  "Tikemia";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  process.env.APP_URL?.trim() ||
  "https://tikemia.com";

const MAIL_FROM =
  process.env.MAIL_FROM_SECURITY?.trim() ||
  process.env.MAIL_FROM_TICKETS?.trim() ||
  process.env.MAIL_FROM_NOREPLY?.trim() ||
  `Tikemia <noreply@tikemia.com>`;

const MAIL_REPLY_TO =
  process.env.MAIL_REPLY_TO_SUPPORT?.trim() ||
  process.env.MAIL_FROM_SUPPORT?.trim() ||
  "support@tikemia.com";

function escapeHtml(
  value: string,
): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeEmail(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase();
}

function isValidCode(
  value: string,
): boolean {
  return /^\d{6}$/.test(
    value,
  );
}

function buildSubject(
  code: string,
): string {
  return `${code} — Code de confirmation de transfert ${APP_NAME}`;
}

function buildText({
  firstName,
  code,
  expiresInMinutes,
  transferReference,
  recipientName,
  ticketsCount,
}: Omit<
  SendTransferCodeEmailParams,
  "to"
>): string {
  const ticketLabel =
    ticketsCount > 1
      ? "billets"
      : "billet";

  return [
    `Bonjour ${firstName},`,
    "",
    `Vous avez demandé le transfert de ${ticketsCount} ${ticketLabel} Tikemia à ${recipientName}.`,
    "",
    `Votre code de confirmation est : ${code}`,
    "",
    `Ce code expire dans ${expiresInMinutes} minute${expiresInMinutes > 1 ? "s" : ""}.`,
    "",
    `Référence du transfert : ${transferReference}`,
    "",
    "Ne partagez jamais ce code. Tikemia ne vous demandera jamais ce code par téléphone, WhatsApp ou message.",
    "",
    "Si vous n’êtes pas à l’origine de cette demande, ne confirmez pas le transfert et contactez immédiatement le support Tikemia.",
    "",
    `Accéder à Tikemia : ${APP_URL}/account/transfers`,
    "",
    "L’équipe Tikemia",
  ].join("\n");
}

function buildHtml({
  firstName,
  code,
  expiresInMinutes,
  transferReference,
  recipientName,
  ticketsCount,
}: Omit<
  SendTransferCodeEmailParams,
  "to"
>): string {
  const safeFirstName =
    escapeHtml(
      firstName,
    );

  const safeCode =
    escapeHtml(
      code,
    );

  const safeReference =
    escapeHtml(
      transferReference,
    );

  const safeRecipientName =
    escapeHtml(
      recipientName,
    );

  const safeAppName =
    escapeHtml(
      APP_NAME,
    );

  const ticketLabel =
    ticketsCount > 1
      ? "billets"
      : "billet";

  const minuteLabel =
    expiresInMinutes > 1
      ? "minutes"
      : "minute";

  const transferUrl =
    `${APP_URL.replace(/\/+$/, "")}/account/transfers`;

  return `
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1"
    />
    <title>Code de confirmation de transfert</title>
  </head>

  <body
    style="
      margin: 0;
      padding: 0;
      background: #03070a;
      color: #ffffff;
      font-family: Arial, Helvetica, sans-serif;
    "
  >
    <table
      role="presentation"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      border="0"
      style="background: #03070a;"
    >
      <tr>
        <td
          align="center"
          style="padding: 28px 14px;"
        >
          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
            style="
              max-width: 640px;
              overflow: hidden;
              border: 1px solid #18252b;
              border-radius: 24px;
              background: #071015;
              box-shadow: 0 24px 70px rgba(0, 0, 0, 0.35);
            "
          >
            <tr>
              <td
                style="
                  padding: 28px 30px;
                  border-bottom: 1px solid #18252b;
                  background:
                    radial-gradient(
                      circle at top right,
                      rgba(132, 204, 22, 0.14),
                      transparent 38%
                    ),
                    #071015;
                "
              >
                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                >
                  <tr>
                    <td>
                      <div
                        style="
                          font-size: 24px;
                          line-height: 30px;
                          font-weight: 900;
                          letter-spacing: -0.5px;
                          color: #ffffff;
                        "
                      >
                        ${safeAppName}
                      </div>

                      <div
                        style="
                          margin-top: 6px;
                          font-size: 12px;
                          line-height: 18px;
                          font-weight: 700;
                          letter-spacing: 1.3px;
                          text-transform: uppercase;
                          color: #a3e635;
                        "
                      >
                        Transfert sécurisé de billet
                      </div>
                    </td>

                    <td
                      align="right"
                      valign="top"
                    >
                      <div
                        style="
                          display: inline-block;
                          padding: 8px 12px;
                          border: 1px solid rgba(52, 211, 153, 0.24);
                          border-radius: 999px;
                          background: rgba(52, 211, 153, 0.08);
                          color: #6ee7b7;
                          font-size: 11px;
                          font-weight: 800;
                        "
                      >
                        Vérification requise
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td
                style="padding: 32px 30px 10px;"
              >
                <p
                  style="
                    margin: 0;
                    font-size: 16px;
                    line-height: 26px;
                    color: #d4d4d4;
                  "
                >
                  Bonjour
                  <strong style="color: #ffffff;">
                    ${safeFirstName}
                  </strong>,
                </p>

                <h1
                  style="
                    margin: 18px 0 0;
                    font-size: 30px;
                    line-height: 38px;
                    letter-spacing: -1px;
                    color: #ffffff;
                  "
                >
                  Confirmez votre transfert
                </h1>

                <p
                  style="
                    margin: 14px 0 0;
                    font-size: 15px;
                    line-height: 25px;
                    color: #9ca3af;
                  "
                >
                  Vous avez demandé le transfert de
                  <strong style="color: #ffffff;">
                    ${ticketsCount} ${ticketLabel}
                  </strong>
                  à
                  <strong style="color: #ffffff;">
                    ${safeRecipientName}
                  </strong>.
                </p>
              </td>
            </tr>

            <tr>
              <td
                align="center"
                style="padding: 26px 30px 18px;"
              >
                <div
                  style="
                    display: inline-block;
                    min-width: 250px;
                    padding: 22px 26px;
                    border: 1px solid rgba(163, 230, 53, 0.28);
                    border-radius: 18px;
                    background: rgba(163, 230, 53, 0.07);
                    box-shadow: inset 0 0 0 1px rgba(163, 230, 53, 0.03);
                  "
                >
                  <div
                    style="
                      font-size: 11px;
                      line-height: 18px;
                      font-weight: 800;
                      letter-spacing: 1.5px;
                      text-transform: uppercase;
                      color: #84cc16;
                    "
                  >
                    Code de confirmation
                  </div>

                  <div
                    style="
                      margin-top: 10px;
                      font-size: 42px;
                      line-height: 48px;
                      font-weight: 900;
                      letter-spacing: 10px;
                      color: #ffffff;
                    "
                  >
                    ${safeCode}
                  </div>
                </div>

                <p
                  style="
                    margin: 16px 0 0;
                    font-size: 13px;
                    line-height: 21px;
                    color: #9ca3af;
                  "
                >
                  Ce code expire dans
                  <strong style="color: #fbbf24;">
                    ${expiresInMinutes} ${minuteLabel}
                  </strong>.
                </p>
              </td>
            </tr>

            <tr>
              <td
                style="padding: 8px 30px 26px;"
              >
                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="
                    border: 1px solid #18252b;
                    border-radius: 16px;
                    background: #03090d;
                  "
                >
                  <tr>
                    <td
                      style="
                        padding: 16px 18px;
                        font-size: 12px;
                        line-height: 18px;
                        color: #6b7280;
                      "
                    >
                      Référence
                    </td>

                    <td
                      align="right"
                      style="
                        padding: 16px 18px;
                        font-family: monospace;
                        font-size: 12px;
                        line-height: 18px;
                        font-weight: 700;
                        color: #d4d4d4;
                      "
                    >
                      ${safeReference}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td
                style="padding: 0 30px 28px;"
              >
                <div
                  style="
                    padding: 16px 18px;
                    border: 1px solid rgba(251, 191, 36, 0.18);
                    border-radius: 16px;
                    background: rgba(251, 191, 36, 0.06);
                  "
                >
                  <p
                    style="
                      margin: 0;
                      font-size: 13px;
                      line-height: 21px;
                      font-weight: 700;
                      color: #fcd34d;
                    "
                  >
                    Ne partagez jamais ce code.
                  </p>

                  <p
                    style="
                      margin: 6px 0 0;
                      font-size: 12px;
                      line-height: 20px;
                      color: #a3a3a3;
                    "
                  >
                    Tikemia ne vous demandera jamais ce code par téléphone,
                    WhatsApp ou message. Si vous n’êtes pas à l’origine de cette
                    demande, ne confirmez pas le transfert.
                  </p>
                </div>
              </td>
            </tr>

            <tr>
              <td
                align="center"
                style="padding: 0 30px 32px;"
              >
                <a
                  href="${escapeHtml(transferUrl)}"
                  style="
                    display: inline-block;
                    padding: 14px 22px;
                    border-radius: 12px;
                    background: linear-gradient(
                      90deg,
                      #10b981,
                      #84cc16,
                      #f97316
                    );
                    color: #ffffff;
                    font-size: 14px;
                    line-height: 20px;
                    font-weight: 900;
                    text-decoration: none;
                  "
                >
                  Ouvrir la page de transfert
                </a>
              </td>
            </tr>

            <tr>
              <td
                style="
                  padding: 22px 30px;
                  border-top: 1px solid #18252b;
                  background: #050b0f;
                "
              >
                <p
                  style="
                    margin: 0;
                    font-size: 11px;
                    line-height: 18px;
                    text-align: center;
                    color: #6b7280;
                  "
                >
                  Cet e-mail a été envoyé automatiquement par ${safeAppName}.
                  Merci de ne pas y répondre directement.
                </p>

                <p
                  style="
                    margin: 8px 0 0;
                    font-size: 11px;
                    line-height: 18px;
                    text-align: center;
                    color: #525252;
                  "
                >
                  Besoin d’aide ? Contactez
                  <a
                    href="mailto:${escapeHtml(MAIL_REPLY_TO)}"
                    style="color: #a3e635; text-decoration: none;"
                  >
                    ${escapeHtml(MAIL_REPLY_TO)}
                  </a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();
}

export async function sendTransferCodeEmail({
  to,
  firstName,
  code,
  expiresInMinutes,
  transferReference,
  recipientName,
  ticketsCount,
}: SendTransferCodeEmailParams): Promise<SendTransferCodeEmailResult> {
  const apiKey =
    process.env.RESEND_API_KEY?.trim();

  const normalizedTo =
    normalizeEmail(
      to,
    );

  if (!apiKey) {
    console.error(
      "[TRANSFER_CODE_EMAIL_ERROR] RESEND_API_KEY manquante.",
    );

    return {
      success: false,
      messageId: null,
      error:
        "La configuration d’envoi des e-mails est incomplète.",
    };
  }

  if (
    !normalizedTo ||
    !normalizedTo.includes("@")
  ) {
    return {
      success: false,
      messageId: null,
      error:
        "L’adresse e-mail du destinataire est invalide.",
    };
  }

  if (
    !firstName.trim() ||
    !recipientName.trim() ||
    !transferReference.trim()
  ) {
    return {
      success: false,
      messageId: null,
      error:
        "Les informations du transfert sont incomplètes.",
    };
  }

  if (!isValidCode(code)) {
    return {
      success: false,
      messageId: null,
      error:
        "Le code de confirmation doit contenir exactement 6 chiffres.",
    };
  }

  if (
    !Number.isInteger(
      expiresInMinutes,
    ) ||
    expiresInMinutes < 1 ||
    expiresInMinutes > 60
  ) {
    return {
      success: false,
      messageId: null,
      error:
        "La durée de validité du code est invalide.",
    };
  }

  if (
    !Number.isInteger(
      ticketsCount,
    ) ||
    ticketsCount < 1
  ) {
    return {
      success: false,
      messageId: null,
      error:
        "Le nombre de billets à transférer est invalide.",
    };
  }

  const resend =
    new Resend(
      apiKey,
    );

  try {
    const response =
      await resend.emails.send({
        from:
          MAIL_FROM,

        to: [
          normalizedTo,
        ],

        replyTo:
          MAIL_REPLY_TO,

        subject:
          buildSubject(
            code,
          ),

        text:
          buildText({
            firstName:
              firstName.trim(),

            code,

            expiresInMinutes,

            transferReference:
              transferReference.trim(),

            recipientName:
              recipientName.trim(),

            ticketsCount,
          }),

        html:
          buildHtml({
            firstName:
              firstName.trim(),

            code,

            expiresInMinutes,

            transferReference:
              transferReference.trim(),

            recipientName:
              recipientName.trim(),

            ticketsCount,
          }),

        headers: {
          "X-Entity-Ref-ID":
            transferReference.trim(),

          "X-Tikemia-Email-Type":
            "ticket-transfer-code",
        },

        tags: [
          {
            name:
              "category",
            value:
              "ticket-transfer",
          },
          {
            name:
              "type",
            value:
              "verification-code",
          },
        ],
      });

    if (response.error) {
      console.error(
        "[TRANSFER_CODE_EMAIL_PROVIDER_ERROR]",
        response.error,
      );

      return {
        success: false,
        messageId: null,
        error:
          response.error.message ||
          "Le fournisseur d’e-mail a refusé l’envoi.",
      };
    }

    return {
      success: true,
      messageId:
        response.data?.id ??
        null,
    };
  } catch (error) {
    console.error(
      "[TRANSFER_CODE_EMAIL_ERROR]",
      error,
    );

    return {
      success: false,
      messageId: null,
      error:
        error instanceof Error
          ? error.message
          : "Impossible d’envoyer le code de confirmation.",
    };
  }
}