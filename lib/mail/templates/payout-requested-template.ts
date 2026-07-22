export type PayoutRequestedTemplateDestinationType =
  | "MOBILE_MONEY"
  | "BANK_ACCOUNT"
  | "CRYPTO_USDT_TRC20";

export type PayoutRequestedTemplateDestination = {
  type: PayoutRequestedTemplateDestinationType;
  label: string;
  accountName: string;
  reference: string;
  country: string;
  countryCode?: string | null;
  mobileProvider?: string | null;
  bankName?: string | null;
  cryptoNetwork?: string | null;
};

export type PayoutRequestedTemplateData = {
  appName?: string;
  organizerName: string;
  organizerEmail: string;

  payout: {
    reference: string;
    amount: number;
    fee: number;
    netAmount: number;
    currency: string;
    requestedAt: Date | string;
    processingDelayHours?: number;
    note?: string | null;
  };

  destination: PayoutRequestedTemplateDestination;

  paymentsUrl: string;
  supportEmail?: string;
};

export type PayoutRequestedTemplateResult = {
  subject: string;
  previewText: string;
  html: string;
  text: string;
};

export class PayoutRequestedTemplateError extends Error {
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
      "PayoutRequestedTemplateError";

    this.code = code;
    this.cause = cause;
  }
}

const DEFAULT_APP_NAME =
  "Tikemia";

const DEFAULT_SUPPORT_EMAIL =
  "support@tikemia.com";

const DEFAULT_PROCESSING_DELAY_HOURS =
  24;

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
    throw new PayoutRequestedTemplateError({
      code:
        "INVALID_PAYOUT_TEMPLATE_DATA",

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

function parseDate(
  value:
    | Date
    | string,
): Date {
  const parsed =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    throw new PayoutRequestedTemplateError({
      code:
        "INVALID_PAYOUT_TEMPLATE_DATE",

      message:
        "La date de la demande de retrait est invalide.",
    });
  }

  return parsed;
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

function getDestinationTypeLabel(
  type:
    PayoutRequestedTemplateDestinationType,
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
    PayoutRequestedTemplateDestination,
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

function buildSummaryRows({
  payout,
  destination,
}: Pick<
  PayoutRequestedTemplateData,
  "payout" | "destination"
>): readonly [
  string,
  string,
  "normal" | "highlight"
][] {
  const delay =
    Math.max(
      Math.floor(
        payout.processingDelayHours ??
          DEFAULT_PROCESSING_DELAY_HOURS,
      ),
      1,
    );

  return [
    [
      "Référence",
      payout.reference,
      "normal",
    ],

    [
      "Montant demandé",
      formatMoney(
        payout.amount,
        payout.currency,
      ),
      "normal",
    ],

    [
      "Frais",
      formatMoney(
        payout.fee,
        payout.currency,
      ),
      "normal",
    ],

    [
      "Net à recevoir",
      formatMoney(
        payout.netAmount,
        payout.currency,
      ),
      "highlight",
    ],

    [
      "Moyen de retrait",
      getDestinationTypeLabel(
        destination.type,
      ),
      "normal",
    ],

    [
      "Service / réseau",
      getDestinationDetail(
        destination,
      ),
      "normal",
    ],

    [
      "Titulaire",
      destination.accountName,
      "normal",
    ],

    [
      "Destination",
      destination.reference,
      "normal",
    ],

    [
      "Pays",
      destination.country,
      "normal",
    ],

    [
      "Date de demande",
      formatDateTime(
        payout.requestedAt,
      ),
      "normal",
    ],

    [
      "Délai estimé",
      `${delay} heure${
        delay > 1
          ? "s"
          : ""
      }`,
      "normal",
    ],
  ] as const;
}

function createHtml({
  appName,
  organizerName,
  organizerEmail,
  payout,
  destination,
  paymentsUrl,
  supportEmail,
}: Required<
  Pick<
    PayoutRequestedTemplateData,
    | "appName"
    | "organizerName"
    | "organizerEmail"
    | "payout"
    | "destination"
    | "paymentsUrl"
    | "supportEmail"
  >
>): string {
  const delay =
    Math.max(
      Math.floor(
        payout.processingDelayHours ??
          DEFAULT_PROCESSING_DELAY_HOURS,
      ),
      1,
    );

  const note =
    normalizeOptionalText(
      payout.note,
    );

  const rows =
    buildSummaryRows({
      payout,
      destination,
    });

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
    <title>Demande de retrait enregistrée</title>
  </head>

  <body style="margin:0;padding:0;background:#020607;font-family:Arial,Helvetica,sans-serif;color:#f5f5f5;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      Votre demande de retrait ${escapeHtml(
        payout.reference,
      )} a bien été enregistrée.
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#020607;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:680px;border:1px solid rgba(255,255,255,0.09);border-radius:24px;overflow:hidden;background:#071014;box-shadow:0 24px 70px rgba(0,0,0,0.45);">
            <tr>
              <td style="padding:28px;border-bottom:1px solid rgba(255,255,255,0.08);background:linear-gradient(135deg,rgba(16,185,129,0.11),rgba(7,16,20,0.96) 55%,rgba(249,115,22,0.05));">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td valign="middle">
                      <div style="font-size:22px;line-height:1.2;font-weight:900;letter-spacing:-0.5px;color:#ffffff;">
                        ${escapeHtml(
                          appName,
                        )}
                      </div>

                      <div style="margin-top:5px;font-size:11px;line-height:1.5;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#6ee7b7;">
                        Paiements & retraits
                      </div>
                    </td>

                    <td align="right" valign="middle">
                      <span style="display:inline-block;padding:8px 12px;border:1px solid rgba(16,185,129,0.25);border-radius:999px;background:rgba(16,185,129,0.08);font-size:10px;font-weight:800;letter-spacing:0.8px;text-transform:uppercase;color:#6ee7b7;">
                        Demande reçue
                      </span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:30px 28px;">
                <h1 style="margin:0;font-size:24px;line-height:1.3;font-weight:900;letter-spacing:-0.5px;color:#ffffff;">
                  Demande de retrait enregistrée
                </h1>

                <p style="margin:18px 0 0;font-size:14px;line-height:1.8;color:#c7d0d5;">
                  Bonjour <strong style="color:#ffffff;">${escapeHtml(
                    organizerName,
                  )}</strong>,
                </p>

                <p style="margin:12px 0 0;font-size:14px;line-height:1.8;color:#9ca3af;">
                  Votre demande de retrait a été enregistrée avec succès. Notre équipe va vérifier les informations et procéder au traitement dans un délai estimé de <strong style="color:#ffffff;">${delay} heure${
                    delay > 1
                      ? "s"
                      : ""
                  }</strong>.
                </p>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin-top:24px;border-collapse:separate;border-spacing:0;border:1px solid rgba(255,255,255,0.08);border-radius:18px;overflow:hidden;background:#050b0f;">
                  ${rows
                    .map(
                      (
                        [
                          label,
                          value,
                          emphasis,
                        ],
                        index,
                      ) => `<tr>
                        <td style="padding:14px 16px;${
                          index > 0
                            ? "border-top:1px solid rgba(255,255,255,0.06);"
                            : ""
                        }font-size:11px;line-height:1.5;color:#6b7280;">
                          ${escapeHtml(
                            label,
                          )}
                        </td>

                        <td align="right" style="padding:14px 16px;${
                          index > 0
                            ? "border-top:1px solid rgba(255,255,255,0.06);"
                            : ""
                        }font-size:${
                          emphasis ===
                          "highlight"
                            ? "14px"
                            : "12px"
                        };line-height:1.5;font-weight:900;color:${
                          emphasis ===
                          "highlight"
                            ? "#6ee7b7"
                            : "#f5f5f5"
                        };">
                          ${escapeHtml(
                            value,
                          )}
                        </td>
                      </tr>`,
                    )
                    .join("")}
                </table>

                ${
                  note
                    ? `<div style="margin-top:18px;padding:16px;border:1px solid rgba(255,255,255,0.08);border-radius:16px;background:#050b0f;">
                        <p style="margin:0;font-size:10px;font-weight:800;letter-spacing:0.8px;text-transform:uppercase;color:#6b7280;">
                          Votre note
                        </p>

                        <p style="margin:8px 0 0;font-size:12px;line-height:1.7;color:#c7d0d5;">
                          ${escapeHtml(
                            note,
                          )}
                        </p>
                      </div>`
                    : ""
                }

                <div style="margin-top:22px;padding:16px;border:1px solid rgba(56,189,248,0.18);border-radius:16px;background:rgba(56,189,248,0.05);">
                  <p style="margin:0;font-size:12px;line-height:1.7;font-weight:900;color:#bae6fd;">
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
              </td>
            </tr>

            <tr>
              <td style="padding:22px 28px;border-top:1px solid rgba(255,255,255,0.07);background:#050b0f;">
                <p style="margin:0;font-size:11px;line-height:1.7;color:#6b7280;">
                  Ce message a été envoyé à ${escapeHtml(
                    organizerEmail,
                  )}. Pour toute question, contactez ${escapeHtml(
                    supportEmail,
                  )}.
                </p>

                <p style="margin:10px 0 0;font-size:10px;line-height:1.7;color:#3f4a51;">
                  Cet e-mail a été envoyé automatiquement par ${escapeHtml(
                    appName,
                  )}. Ne partagez jamais vos identifiants, mots de passe ou codes de sécurité.
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

function createText({
  appName,
  organizerName,
  organizerEmail,
  payout,
  destination,
  paymentsUrl,
  supportEmail,
}: Required<
  Pick<
    PayoutRequestedTemplateData,
    | "appName"
    | "organizerName"
    | "organizerEmail"
    | "payout"
    | "destination"
    | "paymentsUrl"
    | "supportEmail"
  >
>): string {
  const delay =
    Math.max(
      Math.floor(
        payout.processingDelayHours ??
          DEFAULT_PROCESSING_DELAY_HOURS,
      ),
      1,
    );

  const note =
    normalizeOptionalText(
      payout.note,
    );

  const rows =
    buildSummaryRows({
      payout,
      destination,
    });

  return [
    `${appName} — Paiements & retraits`,
    "",
    `Bonjour ${organizerName},`,
    "",
    "Votre demande de retrait a été enregistrée avec succès.",
    `Elle sera vérifiée et traitée dans un délai estimé de ${delay} heure${
      delay > 1
        ? "s"
        : ""
    }.`,
    "",
    ...rows.map(
      (
        [
          label,
          value,
        ],
      ) =>
        `${label} : ${value}`,
    ),
    ...(note
      ? [
          "",
          `Votre note : ${note}`,
        ]
      : []),
    "",
    `Suivi : ${paymentsUrl}`,
    "",
    `E-mail destinataire : ${organizerEmail}`,
    `Support : ${supportEmail}`,
    "",
    `${appName} — Paiements & retraits`,
  ].join("\n");
}

export function createPayoutRequestedTemplate(
  data:
    PayoutRequestedTemplateData,
): PayoutRequestedTemplateResult {
  const appName =
    normalizeText(
      data.appName,
    ) ||
    DEFAULT_APP_NAME;

  const organizerName =
    assertRequiredText({
      value:
        data.organizerName,

      field:
        "organizerName",
    });

  const organizerEmail =
    assertRequiredText({
      value:
        data.organizerEmail,

      field:
        "organizerEmail",
    });

  const payoutReference =
    assertRequiredText({
      value:
        data.payout.reference,

      field:
        "payout.reference",
    });

  const currency =
    assertRequiredText({
      value:
        data.payout.currency,

      field:
        "payout.currency",
    }).toUpperCase();

  const destinationLabel =
    assertRequiredText({
      value:
        data.destination.label,

      field:
        "destination.label",
    });

  const destinationAccountName =
    assertRequiredText({
      value:
        data.destination.accountName,

      field:
        "destination.accountName",
    });

  const destinationReference =
    assertRequiredText({
      value:
        data.destination.reference,

      field:
        "destination.reference",
    });

  const destinationCountry =
    assertRequiredText({
      value:
        data.destination.country,

      field:
        "destination.country",
    });

  const paymentsUrl =
    assertRequiredText({
      value:
        data.paymentsUrl,

      field:
        "paymentsUrl",
    });

  const supportEmail =
    normalizeText(
      data.supportEmail,
    ) ||
    DEFAULT_SUPPORT_EMAIL;

  parseDate(
    data.payout.requestedAt,
  );

  const normalizedData = {
    appName,
    organizerName,
    organizerEmail,

    payout: {
      ...data.payout,

      reference:
        payoutReference,

      amount:
        safeNumber(
          data.payout.amount,
        ),

      fee:
        safeNumber(
          data.payout.fee,
        ),

      netAmount:
        safeNumber(
          data.payout.netAmount,
        ),

      currency,
    },

    destination: {
      ...data.destination,

      label:
        destinationLabel,

      accountName:
        destinationAccountName,

      reference:
        destinationReference,

      country:
        destinationCountry,
    },

    paymentsUrl,
    supportEmail,
  };

  const subject =
    `Retrait ${payoutReference} reçu — ${appName}`;

  const previewText =
    `Votre demande de retrait ${payoutReference} a bien été enregistrée.`;

  return {
    subject,
    previewText,

    html:
      createHtml(
        normalizedData,
      ),

    text:
      createText(
        normalizedData,
      ),
  };
}

export default createPayoutRequestedTemplate;