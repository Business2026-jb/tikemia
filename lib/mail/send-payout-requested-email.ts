import { Resend } from "resend";

export type PayoutRequestedDestinationType =
  | "MOBILE_MONEY"
  | "BANK_ACCOUNT"
  | "CRYPTO_USDT_TRC20";

export type PayoutRequestedEmailDestination = {
  type: PayoutRequestedDestinationType;

  label: string;
  accountName: string;

  country: string;
  countryCode?: string | null;

  reference: string;

  mobileProvider?: string | null;
  bankName?: string | null;
  cryptoNetwork?: string | null;
};

export type SendPayoutRequestedEmailParams = {
  organizer: {
    firstName?: string | null;
    lastName?: string | null;
    businessName?: string | null;
    email: string;
    phone?: string | null;
  };

  payout: {
    id: string;
    reference: string;

    amount: number;
    fee: number;
    netAmount: number;

    currency: string;
    status?: string | null;

    requestedAt:
      | Date
      | string;

    processingDelayHours?: number;

    note?: string | null;
  };

  destination:
    PayoutRequestedEmailDestination;

  organizerPaymentsUrl?: string;
  adminPaymentsUrl?: string;

  adminEmail?: string;
};

export type SendPayoutRequestedEmailResult = {
  organizerEmail: {
    sent: boolean;
    id: string | null;
  };

  adminEmail: {
    sent: boolean;
    id: string | null;
  };
};

export class SendPayoutRequestedEmailError extends Error {
  readonly code: string;
  readonly cause?: unknown;

  constructor({
    code,
    message,
    cause,
  }: {
    code: string;
    message: string;
    cause?: unknown;
  }) {
    super(message);

    this.name =
      "SendPayoutRequestedEmailError";

    this.code = code;
    this.cause = cause;
  }
}

const DEFAULT_APP_NAME =
  "Tikemia";

const DEFAULT_PUBLIC_URL =
  "https://tikemia.com";

const DEFAULT_ADMIN_EMAIL =
  "support@tikemia.com";

const DEFAULT_FROM_EMAIL =
  "Tikemia Retraits <retrait@tikemia.com>";

const DEFAULT_REPLY_TO =
  "support@tikemia.com";

const DEFAULT_PROCESSING_DELAY_HOURS =
  24;

const resend =
  new Resend(
    process.env.RESEND_API_KEY,
  );

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string {
  return value?.trim() ?? "";
}

function normalizeOptionalText(
  value:
    | string
    | null
    | undefined,
): string | null {
  const normalized =
    normalizeText(value);

  return normalized || null;
}

function assertRequiredText({
  value,
  field,
}: {
  value:
    | string
    | null
    | undefined;
  field: string;
}): string {
  const normalized =
    normalizeText(value);

  if (!normalized) {
    throw new SendPayoutRequestedEmailError({
      code:
        "INVALID_PAYOUT_EMAIL_DATA",

      message:
        `Le champ obligatoire « ${field} » est manquant.`,
    });
  }

  return normalized;
}

function safeNumber(
  value: number,
): number {
  return Number.isFinite(value)
    ? Math.max(value, 0)
    : 0;
}

function escapeHtml(
  value:
    | string
    | number
    | null
    | undefined,
): string {
  return String(
    value ?? "",
  )
    .replace(
      /&/g,
      "&amp;",
    )
    .replace(
      /</g,
      "&lt;",
    )
    .replace(
      />/g,
      "&gt;",
    )
    .replace(
      /"/g,
      "&quot;",
    )
    .replace(
      /'/g,
      "&#039;",
    );
}

function formatMoney(
  value: number,
  currency: string,
): string {
  const amount =
    safeNumber(value);

  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style:
          "currency",

        currency,

        minimumFractionDigits:
          currency === "XOF" ||
          currency === "XAF"
            ? 0
            : 2,

        maximumFractionDigits:
          currency === "XOF" ||
          currency === "XAF"
            ? 0
            : 2,
      },
    ).format(amount);
  } catch {
    return `${new Intl.NumberFormat(
      "fr-FR",
      {
        maximumFractionDigits:
          2,
      },
    ).format(amount)} ${currency}`;
  }
}

function parseDate(
  value:
    | Date
    | string,
): Date {
  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    throw new SendPayoutRequestedEmailError({
      code:
        "INVALID_PAYOUT_REQUEST_DATE",

      message:
        "La date de la demande de retrait est invalide.",
    });
  }

  return date;
}

function formatDateTime(
  value:
    | Date
    | string,
): string {
  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      dateStyle:
        "long",

      timeStyle:
        "short",

      timeZone:
        "Africa/Porto-Novo",
    },
  ).format(
    parseDate(value),
  );
}

function getOrganizerDisplayName({
  firstName,
  lastName,
  businessName,
  email,
}: SendPayoutRequestedEmailParams["organizer"]): string {
  const fullName =
    `${normalizeText(
      firstName,
    )} ${normalizeText(
      lastName,
    )}`
      .replace(
        /\s+/g,
        " ",
      )
      .trim();

  return (
    normalizeText(
      businessName,
    ) ||
    fullName ||
    normalizeText(
      email,
    ) ||
    "Organisateur Tikemia"
  );
}

function getDestinationTypeLabel(
  type:
    PayoutRequestedDestinationType,
): string {
  if (
    type ===
    "MOBILE_MONEY"
  ) {
    return "Mobile Money";
  }

  if (
    type ===
    "BANK_ACCOUNT"
  ) {
    return "Virement bancaire";
  }

  return "USDT TRC20";
}

function getDestinationDetail(
  destination:
    PayoutRequestedEmailDestination,
): string {
  if (
    destination.type ===
    "MOBILE_MONEY"
  ) {
    return (
      normalizeOptionalText(
        destination.mobileProvider,
      ) ??
      "Mobile Money"
    );
  }

  if (
    destination.type ===
    "BANK_ACCOUNT"
  ) {
    return (
      normalizeOptionalText(
        destination.bankName,
      ) ??
      "Compte bancaire"
    );
  }

  return (
    normalizeOptionalText(
      destination.cryptoNetwork,
    ) ??
    "TRC20"
  );
}

function buildUrl(
  value:
    | string
    | null
    | undefined,
  fallbackPath: string,
): string {
  const configured =
    normalizeText(value);

  if (configured) {
    return configured;
  }

  const baseUrl =
    normalizeText(
      process.env.NEXT_PUBLIC_APP_URL,
    ) ||
    normalizeText(
      process.env.APP_URL,
    ) ||
    DEFAULT_PUBLIC_URL;

  try {
    return new URL(
      fallbackPath,
      baseUrl,
    ).toString();
  } catch {
    return `${DEFAULT_PUBLIC_URL}${fallbackPath}`;
  }
}

function createEmailLayout({
  preview,
  title,
  badge,
  content,
  footerText,
}: {
  preview: string;
  title: string;
  badge: string;
  content: string;
  footerText: string;
}): string {
  const appName =
    normalizeText(
      process.env.APP_NAME,
    ) ||
    DEFAULT_APP_NAME;

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
    <title>${escapeHtml(title)}</title>
  </head>

  <body style="margin:0;padding:0;background:#020607;font-family:Arial,Helvetica,sans-serif;color:#f5f5f5;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${escapeHtml(preview)}
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#020607;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:680px;border:1px solid rgba(255,255,255,0.09);border-radius:24px;overflow:hidden;background:#071014;box-shadow:0 24px 70px rgba(0,0,0,0.45);">
            <tr>
              <td style="padding:28px 28px 22px;border-bottom:1px solid rgba(255,255,255,0.08);background:linear-gradient(135deg,rgba(16,185,129,0.10),rgba(7,16,20,0.95) 55%,rgba(249,115,22,0.06));">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td valign="middle">
                      <div style="font-size:22px;line-height:1.2;font-weight:900;letter-spacing:-0.5px;color:#ffffff;">
                        ${escapeHtml(appName)}
                      </div>

                      <div style="margin-top:5px;font-size:11px;line-height:1.5;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#6ee7b7;">
                        Paiements & retraits
                      </div>
                    </td>

                    <td align="right" valign="middle">
                      <span style="display:inline-block;padding:8px 12px;border:1px solid rgba(16,185,129,0.25);border-radius:999px;background:rgba(16,185,129,0.08);font-size:10px;font-weight:800;letter-spacing:0.8px;text-transform:uppercase;color:#6ee7b7;">
                        ${escapeHtml(badge)}
                      </span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:30px 28px;">
                <h1 style="margin:0;font-size:24px;line-height:1.3;font-weight:900;letter-spacing:-0.5px;color:#ffffff;">
                  ${escapeHtml(title)}
                </h1>

                ${content}
              </td>
            </tr>

            <tr>
              <td style="padding:22px 28px;border-top:1px solid rgba(255,255,255,0.07);background:#050b0f;">
                <p style="margin:0;font-size:11px;line-height:1.7;color:#6b7280;">
                  ${escapeHtml(footerText)}
                </p>

                <p style="margin:10px 0 0;font-size:10px;line-height:1.7;color:#3f4a51;">
                  Cet e-mail a été envoyé automatiquement par ${escapeHtml(appName)}. Ne partagez jamais vos identifiants, mots de passe ou codes de sécurité.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function createSummaryTable({
  amount,
  fee,
  netAmount,
  currency,
  reference,
  requestedAt,
  processingDelayHours,
  destination,
}: {
  amount: number;
  fee: number;
  netAmount: number;
  currency: string;
  reference: string;
  requestedAt:
    | Date
    | string;
  processingDelayHours: number;
  destination:
    PayoutRequestedEmailDestination;
}): string {
  const rows = [
    [
      "Référence",
      reference,
    ],

    [
      "Montant demandé",
      formatMoney(
        amount,
        currency,
      ),
    ],

    [
      "Frais",
      formatMoney(
        fee,
        currency,
      ),
    ],

    [
      "Net à recevoir",
      formatMoney(
        netAmount,
        currency,
      ),
    ],

    [
      "Destination",
      destination.label,
    ],

    [
      "Coordonnées",
      destination.reference,
    ],

    [
      "Pays",
      destination.country,
    ],

    [
      "Date de demande",
      formatDateTime(
        requestedAt,
      ),
    ],

    [
      "Délai annoncé",
      `${processingDelayHours} heure${
        processingDelayHours > 1
          ? "s"
          : ""
      }`,
    ],
  ] as const;

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin-top:24px;border-collapse:separate;border-spacing:0;border:1px solid rgba(255,255,255,0.08);border-radius:18px;overflow:hidden;background:#050b0f;">
    ${rows
      .map(
        (
          [
            label,
            value,
          ],
          index,
        ) => `<tr>
          <td style="padding:14px 16px;${
            index > 0
              ? "border-top:1px solid rgba(255,255,255,0.06);"
              : ""
          }font-size:11px;line-height:1.5;color:#6b7280;">
            ${escapeHtml(label)}
          </td>

          <td align="right" style="padding:14px 16px;${
            index > 0
              ? "border-top:1px solid rgba(255,255,255,0.06);"
              : ""
          }font-size:12px;line-height:1.5;font-weight:800;color:${
            label ===
            "Net à recevoir"
              ? "#6ee7b7"
              : "#f5f5f5"
          };">
            ${escapeHtml(value)}
          </td>
        </tr>`,
      )
      .join("")}
  </table>`;
}

function createOrganizerHtml({
  params,
  organizerName,
  paymentsUrl,
}: {
  params:
    SendPayoutRequestedEmailParams;
  organizerName: string;
  paymentsUrl: string;
}): string {
  const processingDelayHours =
    Math.max(
      Math.floor(
        params.payout.processingDelayHours ??
        DEFAULT_PROCESSING_DELAY_HOURS,
      ),
      1,
    );

  const summary =
    createSummaryTable({
      amount:
        params.payout.amount,

      fee:
        params.payout.fee,

      netAmount:
        params.payout.netAmount,

      currency:
        params.payout.currency,

      reference:
        params.payout.reference,

      requestedAt:
        params.payout.requestedAt,

      processingDelayHours,

      destination:
        params.destination,
    });

  return createEmailLayout({
    preview:
      `Votre demande de retrait ${params.payout.reference} a bien été enregistrée.`,

    title:
      "Demande de retrait enregistrée",

    badge:
      "Demande reçue",

    footerText:
      "Vous pouvez consulter le suivi de votre retrait depuis votre espace organisateur Tikemia.",

    content: `
      <p style="margin:18px 0 0;font-size:14px;line-height:1.8;color:#c7d0d5;">
        Bonjour <strong style="color:#ffffff;">${escapeHtml(
          organizerName,
        )}</strong>,
      </p>

      <p style="margin:12px 0 0;font-size:14px;line-height:1.8;color:#9ca3af;">
        Votre demande de retrait a été enregistrée avec succès. Notre équipe va vérifier les informations et procéder au traitement dans un délai estimé de <strong style="color:#ffffff;">${processingDelayHours} heure${
          processingDelayHours > 1
            ? "s"
            : ""
        }</strong>.
      </p>

      ${summary}

      <div style="margin-top:22px;padding:16px;border:1px solid rgba(56,189,248,0.18);border-radius:16px;background:rgba(56,189,248,0.05);">
        <p style="margin:0;font-size:12px;line-height:1.7;font-weight:800;color:#bae6fd;">
          Traitement sécurisé
        </p>

        <p style="margin:6px 0 0;font-size:11px;line-height:1.7;color:#7b8b93;">
          Le montant correspondant reste réservé jusqu’à la décision finale. En cas d’information incorrecte, le retrait peut être retardé ou rejeté.
        </p>
      </div>

      <div style="margin-top:24px;text-align:center;">
        <a href="${escapeHtml(
          paymentsUrl,
        )}" style="display:inline-block;padding:13px 20px;border-radius:12px;background:#10b981;color:#022c22;text-decoration:none;font-size:12px;font-weight:900;">
          Suivre mon retrait
        </a>
      </div>
    `,
  });
}

function createAdminHtml({
  params,
  organizerName,
  adminPaymentsUrl,
}: {
  params:
    SendPayoutRequestedEmailParams;
  organizerName: string;
  adminPaymentsUrl: string;
}): string {
  const processingDelayHours =
    Math.max(
      Math.floor(
        params.payout.processingDelayHours ??
        DEFAULT_PROCESSING_DELAY_HOURS,
      ),
      1,
    );

  const summary =
    createSummaryTable({
      amount:
        params.payout.amount,

      fee:
        params.payout.fee,

      netAmount:
        params.payout.netAmount,

      currency:
        params.payout.currency,

      reference:
        params.payout.reference,

      requestedAt:
        params.payout.requestedAt,

      processingDelayHours,

      destination:
        params.destination,
    });

  const note =
    normalizeOptionalText(
      params.payout.note,
    );

  return createEmailLayout({
    preview:
      `Nouveau retrait ${params.payout.reference} demandé par ${organizerName}.`,

    title:
      "Nouvelle demande de retrait",

    badge:
      "Action admin",

    footerText:
      "Cette notification est destinée à l’équipe de validation Tikemia.",

    content: `
      <p style="margin:18px 0 0;font-size:14px;line-height:1.8;color:#9ca3af;">
        Une nouvelle demande de retrait vient d’être soumise et nécessite une vérification administrative.
      </p>

      <div style="margin-top:22px;padding:16px;border:1px solid rgba(249,115,22,0.18);border-radius:16px;background:rgba(249,115,22,0.05);">
        <p style="margin:0;font-size:12px;font-weight:900;color:#fdba74;">
          Organisateur
        </p>

        <p style="margin:8px 0 0;font-size:13px;line-height:1.7;color:#ffffff;">
          ${escapeHtml(organizerName)}
        </p>

        <p style="margin:4px 0 0;font-size:11px;line-height:1.7;color:#7b8b93;">
          ${escapeHtml(params.organizer.email)}
          ${
            normalizeOptionalText(
              params.organizer.phone,
            )
              ? ` • ${escapeHtml(
                  params.organizer.phone,
                )}`
              : ""
          }
        </p>
      </div>

      ${summary}

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin-top:18px;border-collapse:separate;border-spacing:0;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;background:#050b0f;">
        <tr>
          <td style="padding:14px 16px;font-size:11px;color:#6b7280;">
            Type
          </td>

          <td align="right" style="padding:14px 16px;font-size:12px;font-weight:800;color:#f5f5f5;">
            ${escapeHtml(
              getDestinationTypeLabel(
                params.destination.type,
              ),
            )}
          </td>
        </tr>

        <tr>
          <td style="padding:14px 16px;border-top:1px solid rgba(255,255,255,0.06);font-size:11px;color:#6b7280;">
            Service / réseau
          </td>

          <td align="right" style="padding:14px 16px;border-top:1px solid rgba(255,255,255,0.06);font-size:12px;font-weight:800;color:#f5f5f5;">
            ${escapeHtml(
              getDestinationDetail(
                params.destination,
              ),
            )}
          </td>
        </tr>

        <tr>
          <td style="padding:14px 16px;border-top:1px solid rgba(255,255,255,0.06);font-size:11px;color:#6b7280;">
            Titulaire
          </td>

          <td align="right" style="padding:14px 16px;border-top:1px solid rgba(255,255,255,0.06);font-size:12px;font-weight:800;color:#f5f5f5;">
            ${escapeHtml(
              params.destination.accountName,
            )}
          </td>
        </tr>
      </table>

      ${
        note
          ? `<div style="margin-top:18px;padding:16px;border:1px solid rgba(255,255,255,0.08);border-radius:16px;background:#050b0f;">
              <p style="margin:0;font-size:10px;font-weight:800;letter-spacing:0.8px;text-transform:uppercase;color:#6b7280;">
                Note de l’organisateur
              </p>

              <p style="margin:8px 0 0;font-size:12px;line-height:1.7;color:#c7d0d5;">
                ${escapeHtml(note)}
              </p>
            </div>`
          : ""
      }

      <div style="margin-top:24px;text-align:center;">
        <a href="${escapeHtml(
          adminPaymentsUrl,
        )}" style="display:inline-block;padding:13px 20px;border-radius:12px;background:#f97316;color:#2b0b00;text-decoration:none;font-size:12px;font-weight:900;">
          Examiner le retrait
        </a>
      </div>
    `,
  });
}

function createOrganizerText({
  params,
  organizerName,
  paymentsUrl,
}: {
  params:
    SendPayoutRequestedEmailParams;
  organizerName: string;
  paymentsUrl: string;
}): string {
  const delay =
    Math.max(
      Math.floor(
        params.payout.processingDelayHours ??
        DEFAULT_PROCESSING_DELAY_HOURS,
      ),
      1,
    );

  return [
    `Bonjour ${organizerName},`,
    "",
    "Votre demande de retrait a été enregistrée avec succès.",
    "",
    `Référence : ${params.payout.reference}`,
    `Montant demandé : ${formatMoney(
      params.payout.amount,
      params.payout.currency,
    )}`,
    `Frais : ${formatMoney(
      params.payout.fee,
      params.payout.currency,
    )}`,
    `Net à recevoir : ${formatMoney(
      params.payout.netAmount,
      params.payout.currency,
    )}`,
    `Destination : ${params.destination.label}`,
    `Coordonnées : ${params.destination.reference}`,
    `Pays : ${params.destination.country}`,
    `Date : ${formatDateTime(
      params.payout.requestedAt,
    )}`,
    "",
    `Votre retrait sera vérifié et traité dans un délai estimé de ${delay} heure${
      delay > 1
        ? "s"
        : ""
    }.`,
    "",
    `Suivi : ${paymentsUrl}`,
    "",
    "Tikemia — Paiements & retraits",
  ].join("\n");
}

function createAdminText({
  params,
  organizerName,
  adminPaymentsUrl,
}: {
  params:
    SendPayoutRequestedEmailParams;
  organizerName: string;
  adminPaymentsUrl: string;
}): string {
  return [
    "Nouvelle demande de retrait Tikemia",
    "",
    `Organisateur : ${organizerName}`,
    `E-mail : ${params.organizer.email}`,
    `Téléphone : ${
      normalizeOptionalText(
        params.organizer.phone,
      ) ??
      "Non renseigné"
    }`,
    "",
    `Référence : ${params.payout.reference}`,
    `Montant demandé : ${formatMoney(
      params.payout.amount,
      params.payout.currency,
    )}`,
    `Frais : ${formatMoney(
      params.payout.fee,
      params.payout.currency,
    )}`,
    `Net à verser : ${formatMoney(
      params.payout.netAmount,
      params.payout.currency,
    )}`,
    `Date : ${formatDateTime(
      params.payout.requestedAt,
    )}`,
    "",
    `Type : ${getDestinationTypeLabel(
      params.destination.type,
    )}`,
    `Service / réseau : ${getDestinationDetail(
      params.destination,
    )}`,
    `Titulaire : ${params.destination.accountName}`,
    `Destination : ${params.destination.reference}`,
    `Pays : ${params.destination.country}`,
    `Note : ${
      normalizeOptionalText(
        params.payout.note,
      ) ??
      "Aucune"
    }`,
    "",
    `Administration : ${adminPaymentsUrl}`,
  ].join("\n");
}

async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<string> {
  const apiKey =
    normalizeText(
      process.env.RESEND_API_KEY,
    );

  if (!apiKey) {
    throw new SendPayoutRequestedEmailError({
      code:
        "RESEND_API_KEY_MISSING",

      message:
        "La clé RESEND_API_KEY est absente.",
    });
  }

  const from =
    normalizeText(
      process.env.MAIL_FROM_PAYOUTS,
    ) ||
    normalizeText(
      process.env.MAIL_FROM_WITHDRAWALS,
    ) ||
    DEFAULT_FROM_EMAIL;

  const replyTo =
    normalizeText(
      process.env.MAIL_REPLY_TO_SUPPORT,
    ) ||
    DEFAULT_REPLY_TO;

  const result =
    await resend.emails.send({
      from,
      to,
      replyTo,
      subject,
      html,
      text,
      headers: {
        "X-Entity-Ref-ID":
          crypto.randomUUID(),
      },
      tags: [
        {
          name:
            "category",

          value:
            "payout-requested",
        },
      ],
    });

  if (
    result.error
  ) {
    throw new SendPayoutRequestedEmailError({
      code:
        "RESEND_SEND_FAILED",

      message:
        result.error.message ||
        "Resend n’a pas pu envoyer l’e-mail.",

      cause:
        result.error,
    });
  }

  if (
    !result.data?.id
  ) {
    throw new SendPayoutRequestedEmailError({
      code:
        "RESEND_RESPONSE_INVALID",

      message:
        "La réponse du service d’e-mail est incomplète.",
    });
  }

  return result.data.id;
}

export async function sendPayoutRequestedEmail(
  params:
    SendPayoutRequestedEmailParams,
): Promise<SendPayoutRequestedEmailResult> {
  const organizerEmail =
    assertRequiredText({
      value:
        params.organizer.email,

      field:
        "organizer.email",
    });

  const payoutReference =
    assertRequiredText({
      value:
        params.payout.reference,

      field:
        "payout.reference",
    });

  assertRequiredText({
    value:
      params.payout.id,

    field:
      "payout.id",
  });

  const currency =
    assertRequiredText({
      value:
        params.payout.currency,

      field:
        "payout.currency",
    }).toUpperCase();

  assertRequiredText({
    value:
      params.destination.label,

    field:
      "destination.label",
  });

  assertRequiredText({
    value:
      params.destination.accountName,

    field:
      "destination.accountName",
  });

  assertRequiredText({
    value:
      params.destination.reference,

    field:
      "destination.reference",
  });

  assertRequiredText({
    value:
      params.destination.country,

    field:
      "destination.country",
  });

  parseDate(
    params.payout.requestedAt,
  );

  const normalizedParams:
    SendPayoutRequestedEmailParams = {
    ...params,

    organizer: {
      ...params.organizer,

      email:
        organizerEmail,
    },

    payout: {
      ...params.payout,

      reference:
        payoutReference,

      amount:
        safeNumber(
          params.payout.amount,
        ),

      fee:
        safeNumber(
          params.payout.fee,
        ),

      netAmount:
        safeNumber(
          params.payout.netAmount,
        ),

      currency,
    },
  };

  const organizerName =
    getOrganizerDisplayName(
      normalizedParams.organizer,
    );

  const organizerPaymentsUrl =
    buildUrl(
      normalizedParams.organizerPaymentsUrl,
      "/organizer/payments",
    );

  const adminPaymentsUrl =
    buildUrl(
      normalizedParams.adminPaymentsUrl,
      `/admin/payments/payouts?reference=${encodeURIComponent(
        payoutReference,
      )}`,
    );

  const adminEmail =
    normalizeText(
      normalizedParams.adminEmail,
    ) ||
    normalizeText(
      process.env.PAYOUT_ADMIN_EMAIL,
    ) ||
    DEFAULT_ADMIN_EMAIL;

  const organizerSubject =
    `Retrait ${payoutReference} reçu — Tikemia`;

  const adminSubject =
    `Nouveau retrait ${payoutReference} — ${organizerName}`;

  try {
    const [
      organizerResult,
      adminResult,
    ] =
      await Promise.allSettled([
        sendEmail({
          to:
            organizerEmail,

          subject:
            organizerSubject,

          html:
            createOrganizerHtml({
              params:
                normalizedParams,

              organizerName,

              paymentsUrl:
                organizerPaymentsUrl,
            }),

          text:
            createOrganizerText({
              params:
                normalizedParams,

              organizerName,

              paymentsUrl:
                organizerPaymentsUrl,
            }),
        }),

        sendEmail({
          to:
            adminEmail,

          subject:
            adminSubject,

          html:
            createAdminHtml({
              params:
                normalizedParams,

              organizerName,

              adminPaymentsUrl,
            }),

          text:
            createAdminText({
              params:
                normalizedParams,

              organizerName,

              adminPaymentsUrl,
            }),
        }),
      ]);

    const organizerSent =
      organizerResult.status ===
      "fulfilled";

    const adminSent =
      adminResult.status ===
      "fulfilled";

    if (
      !organizerSent ||
      !adminSent
    ) {
      console.error(
        "[SEND_PAYOUT_REQUESTED_EMAIL_PARTIAL_FAILURE]",
        {
          payoutReference,

          organizerError:
            organizerResult.status ===
            "rejected"
              ? organizerResult.reason
              : null,

          adminError:
            adminResult.status ===
            "rejected"
              ? adminResult.reason
              : null,
        },
      );
    }

    if (
      !organizerSent &&
      !adminSent
    ) {
      throw new SendPayoutRequestedEmailError({
        code:
          "PAYOUT_EMAILS_FAILED",

        message:
          "Les e-mails de confirmation du retrait n’ont pas pu être envoyés.",

        cause: {
          organizer:
            organizerResult.status ===
            "rejected"
              ? organizerResult.reason
              : null,

          admin:
            adminResult.status ===
            "rejected"
              ? adminResult.reason
              : null,
        },
      });
    }

    return {
      organizerEmail: {
        sent:
          organizerSent,

        id:
          organizerResult.status ===
          "fulfilled"
            ? organizerResult.value
            : null,
      },

      adminEmail: {
        sent:
          adminSent,

        id:
          adminResult.status ===
          "fulfilled"
            ? adminResult.value
            : null,
      },
    };
  } catch (error) {
    if (
      error instanceof
      SendPayoutRequestedEmailError
    ) {
      throw error;
    }

    console.error(
      "[SEND_PAYOUT_REQUESTED_EMAIL_ERROR]",
      error instanceof Error
        ? {
            name:
              error.name,

            message:
              error.message,

            stack:
              process.env.NODE_ENV ===
              "development"
                ? error.stack
                : undefined,
          }
        : error,
    );

    throw new SendPayoutRequestedEmailError({
      code:
        "PAYOUT_EMAIL_SEND_FAILED",

      message:
        "Impossible d’envoyer les e-mails liés à la demande de retrait.",

      cause:
        error,
    });
  }
}