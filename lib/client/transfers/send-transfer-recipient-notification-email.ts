import { Resend } from "resend";

export type ReceivedTicketSummary = {
  ticketTypeName: string;
  ticketCode: string;
};

export type SendTransferRecipientNotificationEmailParams = {
  to: string;
  firstName: string;
  senderName: string;
  senderMaskedEmail?: string | null;
  transferReference: string;
  eventTitle: string;
  eventStartsAt: Date;
  eventVenueName: string;
  eventCity: string;
  tickets: ReceivedTicketSummary[];
  completedAt?: Date;
};

export type SendTransferRecipientNotificationEmailResult =
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
  process.env.MAIL_FROM_TICKETS?.trim() ||
  process.env.MAIL_FROM_SECURITY?.trim() ||
  process.env.MAIL_FROM_NOREPLY?.trim() ||
  "Tikemia <noreply@tikemia.com>";

const MAIL_REPLY_TO =
  process.env.MAIL_REPLY_TO_SUPPORT?.trim() ||
  process.env.MAIL_FROM_SUPPORT?.trim() ||
  "support@tikemia.com";

const APP_TIMEZONE =
  process.env.APP_TIMEZONE?.trim() ||
  "Africa/Porto-Novo";

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

function isValidEmail(
  value: string,
): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value,
  );
}

function formatDateTime(
  value: Date,
): string {
  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      weekday:
        "long",
      day:
        "2-digit",
      month:
        "long",
      year:
        "numeric",
      hour:
        "2-digit",
      minute:
        "2-digit",
      timeZone:
        APP_TIMEZONE,
    },
  ).format(value);
}

function getTicketLabel(
  count: number,
): string {
  return count > 1
    ? `${count} billets`
    : "1 billet";
}

function buildSubject({
  eventTitle,
  ticketsCount,
}: {
  eventTitle: string;
  ticketsCount: number;
}): string {
  return ticketsCount > 1
    ? `Vous avez reçu ${ticketsCount} billets — ${eventTitle}`
    : `Vous avez reçu un billet — ${eventTitle}`;
}

function buildText({
  firstName,
  senderName,
  senderMaskedEmail,
  transferReference,
  eventTitle,
  eventStartsAt,
  eventVenueName,
  eventCity,
  tickets,
  completedAt,
}: Omit<
  SendTransferRecipientNotificationEmailParams,
  "to"
>): string {
  const receivedAt =
    completedAt ??
    new Date();

  const ticketLines =
    tickets.map(
      (
        ticket,
        index,
      ) =>
        `${index + 1}. ${ticket.ticketTypeName} — ${ticket.ticketCode}`,
    );

  return [
    `Bonjour ${firstName},`,
    "",
    `${senderName}${senderMaskedEmail ? ` (${senderMaskedEmail})` : ""} vous a transféré ${getTicketLabel(tickets.length)} sur Tikemia.`,
    "",
    `Événement : ${eventTitle}`,
    `Date : ${formatDateTime(eventStartsAt)}`,
    `Lieu : ${eventVenueName}, ${eventCity}`,
    `Reçu le : ${formatDateTime(receivedAt)}`,
    `Référence : ${transferReference}`,
    "",
    "Billets reçus :",
    ...ticketLines,
    "",
    "Ces billets sont maintenant rattachés à votre compte Tikemia et portent vos informations.",
    "Ils sont disponibles dans votre espace Mes billets.",
    "",
    `Voir mes billets : ${APP_URL.replace(/\/+$/, "")}/account/tickets`,
    "",
    "Si vous ne reconnaissez pas ce transfert, contactez immédiatement le support Tikemia.",
    "",
    "L’équipe Tikemia",
  ].join("\n");
}

function buildTicketsRows(
  tickets: ReceivedTicketSummary[],
): string {
  return tickets
    .map(
      (
        ticket,
        index,
      ) => `
        <tr>
          <td
            style="
              padding: 14px 16px;
              border-top: ${
                index === 0
                  ? "0"
                  : "1px solid #18252b"
              };
            "
          >
            <div
              style="
                font-size: 13px;
                line-height: 20px;
                font-weight: 800;
                color: #ffffff;
              "
            >
              ${escapeHtml(ticket.ticketTypeName)}
            </div>

            <div
              style="
                margin-top: 4px;
                font-family: monospace;
                font-size: 11px;
                line-height: 18px;
                color: #737373;
              "
            >
              ${escapeHtml(ticket.ticketCode)}
            </div>
          </td>
        </tr>
      `,
    )
    .join("");
}

function buildHtml({
  firstName,
  senderName,
  senderMaskedEmail,
  transferReference,
  eventTitle,
  eventStartsAt,
  eventVenueName,
  eventCity,
  tickets,
  completedAt,
}: Omit<
  SendTransferRecipientNotificationEmailParams,
  "to"
>): string {
  const receivedAt =
    completedAt ??
    new Date();

  const ticketsUrl =
    `${APP_URL.replace(/\/+$/, "")}/account/tickets`;

  const senderDetails =
    senderMaskedEmail
      ? `${escapeHtml(senderName)} (${escapeHtml(senderMaskedEmail)})`
      : escapeHtml(senderName);

  return `
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width,initial-scale=1"
    />
    <title>Billets reçus</title>
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
              max-width: 660px;
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
                      rgba(132, 204, 22, 0.16),
                      transparent 38%
                    ),
                    #071015;
                "
              >
                <div
                  style="
                    font-size: 24px;
                    line-height: 30px;
                    font-weight: 900;
                    letter-spacing: -0.5px;
                    color: #ffffff;
                  "
                >
                  ${escapeHtml(APP_NAME)}
                </div>

                <div
                  style="
                    margin-top: 6px;
                    font-size: 12px;
                    line-height: 18px;
                    font-weight: 800;
                    letter-spacing: 1.3px;
                    text-transform: uppercase;
                    color: #a3e635;
                  "
                >
                  Billets reçus
                </div>
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
                    ${escapeHtml(firstName)}
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
                  Vous avez reçu ${getTicketLabel(tickets.length)}
                </h1>

                <p
                  style="
                    margin: 14px 0 0;
                    font-size: 15px;
                    line-height: 25px;
                    color: #9ca3af;
                  "
                >
                  <strong style="color: #ffffff;">
                    ${senderDetails}
                  </strong>
                  vous a transféré
                  <strong style="color: #ffffff;">
                    ${getTicketLabel(tickets.length)}
                  </strong>
                  sur Tikemia.
                </p>
              </td>
            </tr>

            <tr>
              <td
                style="padding: 22px 30px 10px;"
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
                        padding: 16px 18px 8px;
                        font-size: 11px;
                        line-height: 18px;
                        font-weight: 800;
                        letter-spacing: 1.2px;
                        text-transform: uppercase;
                        color: #84cc16;
                      "
                    >
                      Événement
                    </td>
                  </tr>

                  <tr>
                    <td
                      style="
                        padding: 0 18px 10px;
                        font-size: 20px;
                        line-height: 28px;
                        font-weight: 900;
                        color: #ffffff;
                      "
                    >
                      ${escapeHtml(eventTitle)}
                    </td>
                  </tr>

                  <tr>
                    <td
                      style="
                        padding: 0 18px 8px;
                        font-size: 13px;
                        line-height: 21px;
                        color: #a3a3a3;
                      "
                    >
                      ${escapeHtml(formatDateTime(eventStartsAt))}
                    </td>
                  </tr>

                  <tr>
                    <td
                      style="
                        padding: 0 18px 16px;
                        font-size: 13px;
                        line-height: 21px;
                        color: #737373;
                      "
                    >
                      ${escapeHtml(`${eventVenueName}, ${eventCity}`)}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td
                style="padding: 14px 30px 10px;"
              >
                <div
                  style="
                    margin-bottom: 10px;
                    font-size: 11px;
                    line-height: 18px;
                    font-weight: 800;
                    letter-spacing: 1.2px;
                    text-transform: uppercase;
                    color: #84cc16;
                  "
                >
                  Billets reçus
                </div>

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
                  ${buildTicketsRows(tickets)}
                </table>
              </td>
            </tr>

            <tr>
              <td
                style="padding: 14px 30px 10px;"
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
                        padding: 14px 16px;
                        font-size: 12px;
                        line-height: 18px;
                        color: #737373;
                      "
                    >
                      Référence
                    </td>

                    <td
                      align="right"
                      style="
                        padding: 14px 16px;
                        font-family: monospace;
                        font-size: 12px;
                        line-height: 18px;
                        font-weight: 700;
                        color: #d4d4d4;
                      "
                    >
                      ${escapeHtml(transferReference)}
                    </td>
                  </tr>

                  <tr>
                    <td
                      style="
                        padding: 14px 16px;
                        border-top: 1px solid #18252b;
                        font-size: 12px;
                        line-height: 18px;
                        color: #737373;
                      "
                    >
                      Reçu le
                    </td>

                    <td
                      align="right"
                      style="
                        padding: 14px 16px;
                        border-top: 1px solid #18252b;
                        font-size: 12px;
                        line-height: 18px;
                        color: #d4d4d4;
                      "
                    >
                      ${escapeHtml(formatDateTime(receivedAt))}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td
                style="padding: 18px 30px 10px;"
              >
                <div
                  style="
                    padding: 16px 18px;
                    border: 1px solid rgba(132, 204, 22, 0.18);
                    border-radius: 16px;
                    background: rgba(132, 204, 22, 0.06);
                  "
                >
                  <p
                    style="
                      margin: 0;
                      font-size: 13px;
                      line-height: 21px;
                      font-weight: 800;
                      color: #bef264;
                    "
                  >
                    Ces billets sont maintenant à votre nom.
                  </p>

                  <p
                    style="
                      margin: 6px 0 0;
                      font-size: 12px;
                      line-height: 20px;
                      color: #a3a3a3;
                    "
                  >
                    Ils sont disponibles dans votre espace Mes billets.
                    Vos informations seront utilisées lors du contrôle à l’entrée.
                  </p>
                </div>
              </td>
            </tr>

            <tr>
              <td
                align="center"
                style="padding: 22px 30px 32px;"
              >
                <a
                  href="${escapeHtml(ticketsUrl)}"
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
                  Voir mes billets
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
                  Si vous ne reconnaissez pas ce transfert,
                  contactez immédiatement le support Tikemia.
                </p>

                <p
                  style="
                    margin: 8px 0 0;
                    font-size: 11px;
                    line-height: 18px;
                    text-align: center;
                  "
                >
                  <a
                    href="mailto:${escapeHtml(MAIL_REPLY_TO)}"
                    style="
                      color: #a3e635;
                      text-decoration: none;
                    "
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

export async function sendTransferRecipientNotificationEmail({
  to,
  firstName,
  senderName,
  senderMaskedEmail,
  transferReference,
  eventTitle,
  eventStartsAt,
  eventVenueName,
  eventCity,
  tickets,
  completedAt,
}: SendTransferRecipientNotificationEmailParams): Promise<SendTransferRecipientNotificationEmailResult> {
  const apiKey =
    process.env.RESEND_API_KEY?.trim();

  const normalizedTo =
    normalizeEmail(
      to,
    );

  if (!apiKey) {
    console.error(
      "[TRANSFER_RECIPIENT_NOTIFICATION_EMAIL_ERROR] RESEND_API_KEY manquante.",
    );

    return {
      success: false,
      messageId: null,
      error:
        "La configuration d’envoi des e-mails est incomplète.",
    };
  }

  if (
    !isValidEmail(
      normalizedTo,
    )
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
    !senderName.trim() ||
    !transferReference.trim() ||
    !eventTitle.trim() ||
    !eventVenueName.trim() ||
    !eventCity.trim()
  ) {
    return {
      success: false,
      messageId: null,
      error:
        "Les informations du transfert sont incomplètes.",
    };
  }

  if (
    !(eventStartsAt instanceof Date) ||
    Number.isNaN(
      eventStartsAt.getTime(),
    ) ||
    (
      completedAt &&
      (
        !(completedAt instanceof Date) ||
        Number.isNaN(
          completedAt.getTime(),
        )
      )
    )
  ) {
    return {
      success: false,
      messageId: null,
      error:
        "La date du transfert ou de l’événement est invalide.",
    };
  }

  if (
    tickets.length < 1 ||
    tickets.some(
      (
        ticket,
      ) =>
        !ticket.ticketTypeName.trim() ||
        !ticket.ticketCode.trim(),
    )
  ) {
    return {
      success: false,
      messageId: null,
      error:
        "La liste des billets reçus est invalide.",
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
          buildSubject({
            eventTitle:
              eventTitle.trim(),

            ticketsCount:
              tickets.length,
          }),

        text:
          buildText({
            firstName:
              firstName.trim(),

            senderName:
              senderName.trim(),

            senderMaskedEmail:
              senderMaskedEmail?.trim() ||
              null,

            transferReference:
              transferReference.trim(),

            eventTitle:
              eventTitle.trim(),

            eventStartsAt,

            eventVenueName:
              eventVenueName.trim(),

            eventCity:
              eventCity.trim(),

            tickets,

            completedAt,
          }),

        html:
          buildHtml({
            firstName:
              firstName.trim(),

            senderName:
              senderName.trim(),

            senderMaskedEmail:
              senderMaskedEmail?.trim() ||
              null,

            transferReference:
              transferReference.trim(),

            eventTitle:
              eventTitle.trim(),

            eventStartsAt,

            eventVenueName:
              eventVenueName.trim(),

            eventCity:
              eventCity.trim(),

            tickets,

            completedAt,
          }),

        headers: {
          "X-Entity-Ref-ID":
            transferReference.trim(),

          "X-Tikemia-Email-Type":
            "ticket-transfer-recipient-notification",
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
              "recipient-notification",
          },
        ],
      });

    if (response.error) {
      console.error(
        "[TRANSFER_RECIPIENT_NOTIFICATION_EMAIL_PROVIDER_ERROR]",
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
      "[TRANSFER_RECIPIENT_NOTIFICATION_EMAIL_ERROR]",
      error,
    );

    return {
      success: false,
      messageId: null,
      error:
        error instanceof Error
          ? error.message
          : "Impossible d’envoyer la notification au destinataire.",
    };
  }
}