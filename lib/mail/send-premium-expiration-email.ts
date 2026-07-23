import "server-only";

import { Resend } from "resend";

const DEFAULT_APP_NAME = "Tikemia";
const DEFAULT_APP_URL = "https://tikemia.com";
const DEFAULT_SUPPORT_EMAIL = "support@tikemia.com";

export type PremiumExpirationEmailKind =
  | "EXPIRING_SOON"
  | "EXPIRED";

export type SendPremiumExpirationEmailInput = {
  to: string;
  firstName?: string | null;
  organizerName?: string | null;
  planName: string;
  expirationDate: Date | string;
  kind?: PremiumExpirationEmailKind;
  remainingDays?: number | null;
  subscriptionId?: string | null;
  renewalUrl?: string | null;
  promotionsUrl?: string | null;
  supportEmail?: string | null;
};

export type SendPremiumExpirationEmailResult = {
  success: true;
  messageId: string | null;
};

export class PremiumExpirationEmailError extends Error {
  readonly code: string;
  readonly status: number;

  constructor({
    code,
    message,
    status = 500,
  }: {
    code: string;
    message: string;
    status?: number;
  }) {
    super(message);

    this.name = "PremiumExpirationEmailError";
    this.code = code;
    this.status = status;
  }
}

function getRequiredEnvironmentVariable(
  key: string,
): string {
  const value = process.env[key]?.trim();

  if (!value) {
    throw new PremiumExpirationEmailError({
      code: "MAIL_CONFIGURATION_MISSING",
      message:
        `La variable d’environnement ${key} n’est pas configurée.`,
    });
  }

  return value;
}

function getAppName(): string {
  return (
    process.env.APP_NAME?.trim() ||
    DEFAULT_APP_NAME
  );
}

function getAppUrl(): string {
  return (
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    DEFAULT_APP_URL
  ).replace(/\/+$/, "");
}

function getMailFrom(): string {
  return (
    process.env.MAIL_FROM_SUBSCRIPTIONS?.trim() ||
    process.env.MAIL_FROM_ORGANIZERS?.trim() ||
    process.env.MAIL_FROM_PAYMENTS?.trim() ||
    getRequiredEnvironmentVariable(
      "MAIL_FROM_SUPPORT",
    )
  );
}

function getReplyTo(
  supportEmail?: string | null,
): string {
  return (
    supportEmail?.trim() ||
    process.env.MAIL_REPLY_TO_SUPPORT?.trim() ||
    DEFAULT_SUPPORT_EMAIL
  );
}

function normalizeEmail(
  value: string,
): string {
  return value.trim().toLowerCase();
}

function isValidEmail(
  value: string,
): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value,
  );
}

function parseDate(
  value: Date | string,
): Date {
  const parsed =
    value instanceof Date
      ? value
      : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new PremiumExpirationEmailError({
      code: "INVALID_EXPIRATION_DATE",
      status: 400,
      message:
        "La date d’expiration de l’abonnement Premium est invalide.",
    });
  }

  return parsed;
}

function formatDate(
  value: Date,
): string {
  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    },
  ).format(value);
}

function escapeHtml(
  value: string,
): string {
  return value.replace(
    /[&<>"']/g,
    (character) => {
      const entities: Record<
        string,
        string
      > = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      };

      return (
        entities[character] ??
        character
      );
    },
  );
}

function buildAbsoluteUrl({
  providedUrl,
  fallbackPath,
}: {
  providedUrl?: string | null;
  fallbackPath: string;
}): string {
  const rawUrl =
    providedUrl?.trim();

  if (rawUrl) {
    try {
      return new URL(
        rawUrl,
        getAppUrl(),
      ).toString();
    } catch {
      // La valeur fournie est ignorée au profit de l’URL sûre par défaut.
    }
  }

  return new URL(
    fallbackPath,
    `${getAppUrl()}/`,
  ).toString();
}

function getGreetingName({
  firstName,
  organizerName,
}: {
  firstName?: string | null;
  organizerName?: string | null;
}): string {
  return (
    firstName?.trim() ||
    organizerName?.trim() ||
    "Organisateur"
  );
}

function getRemainingDays(
  expirationDate: Date,
  explicitValue?: number | null,
): number {
  if (
    typeof explicitValue ===
      "number" &&
    Number.isFinite(explicitValue)
  ) {
    return Math.max(
      0,
      Math.ceil(explicitValue),
    );
  }

  const millisecondsPerDay =
    24 * 60 * 60 * 1000;

  return Math.max(
    0,
    Math.ceil(
      (expirationDate.getTime() -
        Date.now()) /
        millisecondsPerDay,
    ),
  );
}

function getSubject({
  kind,
  planName,
  remainingDays,
}: {
  kind: PremiumExpirationEmailKind;
  planName: string;
  remainingDays: number;
}): string {
  if (kind === "EXPIRED") {
    return `Votre abonnement Premium ${planName} a expiré`;
  }

  if (remainingDays <= 1) {
    return `Votre abonnement Premium ${planName} expire demain`;
  }

  return `Votre abonnement Premium ${planName} expire dans ${remainingDays} jours`;
}

function buildTextEmail({
  appName,
  greetingName,
  planName,
  expirationDateLabel,
  kind,
  remainingDays,
  renewalUrl,
  promotionsUrl,
  supportEmail,
}: {
  appName: string;
  greetingName: string;
  planName: string;
  expirationDateLabel: string;
  kind: PremiumExpirationEmailKind;
  remainingDays: number;
  renewalUrl: string;
  promotionsUrl: string;
  supportEmail: string;
}): string {
  const statusMessage =
    kind === "EXPIRED"
      ? `Votre abonnement Premium « ${planName} » a expiré le ${expirationDateLabel}.`
      : `Votre abonnement Premium « ${planName} » arrivera à expiration le ${expirationDateLabel}, soit dans ${remainingDays} jour${remainingDays > 1 ? "s" : ""}.`;

  return [
    `Bonjour ${greetingName},`,
    "",
    statusMessage,
    "",
    kind === "EXPIRED"
      ? "Vos événements ne bénéficient plus du classement prioritaire Premium. Votre badge bleu organisateur reste toutefois définitivement acquis."
      : "Renouvelez votre formule avant cette date pour conserver la priorité d’affichage de vos événements sans interruption.",
    "",
    `Renouveler mon abonnement : ${renewalUrl}`,
    `Gérer mes promotions : ${promotionsUrl}`,
    "",
    "Important : l’expiration de la formule ne supprime aucun événement, billet, commande ou paiement.",
    "",
    `Besoin d’aide ? Contactez-nous à ${supportEmail}.`,
    "",
    `L’équipe ${appName}`,
  ].join("\n");
}

function buildHtmlEmail({
  appName,
  greetingName,
  planName,
  expirationDateLabel,
  kind,
  remainingDays,
  renewalUrl,
  promotionsUrl,
  supportEmail,
}: {
  appName: string;
  greetingName: string;
  planName: string;
  expirationDateLabel: string;
  kind: PremiumExpirationEmailKind;
  remainingDays: number;
  renewalUrl: string;
  promotionsUrl: string;
  supportEmail: string;
}): string {
  const safeAppName =
    escapeHtml(appName);
  const safeGreetingName =
    escapeHtml(greetingName);
  const safePlanName =
    escapeHtml(planName);
  const safeExpirationDate =
    escapeHtml(
      expirationDateLabel,
    );
  const safeSupportEmail =
    escapeHtml(supportEmail);
  const safeRenewalUrl =
    escapeHtml(renewalUrl);
  const safePromotionsUrl =
    escapeHtml(promotionsUrl);

  const headline =
    kind === "EXPIRED"
      ? "Votre formule Premium a expiré"
      : "Votre formule Premium arrive bientôt à expiration";

  const statusMessage =
    kind === "EXPIRED"
      ? `Votre abonnement <strong style="color:#ffffff;">${safePlanName}</strong> a expiré le <strong style="color:#fb923c;">${safeExpirationDate}</strong>.`
      : `Votre abonnement <strong style="color:#ffffff;">${safePlanName}</strong> expirera le <strong style="color:#a3e635;">${safeExpirationDate}</strong>, soit dans <strong style="color:#a3e635;">${remainingDays} jour${remainingDays > 1 ? "s" : ""}</strong>.`;

  const mainMessage =
    kind === "EXPIRED"
      ? "Vos événements ne bénéficient plus du classement prioritaire Premium. Vous pouvez renouveler votre formule à tout moment pour réactiver cette visibilité."
      : "Renouvelez votre abonnement avant cette date afin que vos événements conservent leur classement prioritaire sans interruption.";

  const badgeLabel =
    kind === "EXPIRED"
      ? "Abonnement expiré"
      : "Expiration prochaine";

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
    <title>${escapeHtml(headline)}</title>
  </head>

  <body style="margin:0;padding:0;background:#020609;font-family:Arial,Helvetica,sans-serif;color:#d4d4d8;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${escapeHtml(
        kind === "EXPIRED"
          ? `Votre abonnement Premium ${planName} a expiré.`
          : `Votre abonnement Premium ${planName} expire bientôt.`,
      )}
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#020609;">
      <tr>
        <td align="center" style="padding:28px 12px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;background:#071015;border:1px solid #1f2937;border-radius:20px;overflow:hidden;">
            <tr>
              <td style="padding:24px 28px;border-bottom:1px solid #1f2937;background:linear-gradient(135deg,rgba(16,185,129,.12),rgba(163,230,53,.05),rgba(249,115,22,.08));">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td>
                      <div style="font-size:22px;font-weight:900;letter-spacing:-0.5px;color:#ffffff;">
                        ${safeAppName}
                      </div>
                      <div style="margin-top:5px;font-size:12px;color:#71717a;">
                        Visibilité Premium organisateur
                      </div>
                    </td>

                    <td align="right">
                      <span style="display:inline-block;padding:7px 11px;border-radius:999px;border:1px solid ${kind === "EXPIRED" ? "#7f1d1d" : "#854d0e"};background:${kind === "EXPIRED" ? "rgba(239,68,68,.10)" : "rgba(249,115,22,.10)"};font-size:10px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:${kind === "EXPIRED" ? "#fca5a5" : "#fdba74"};">
                        ${badgeLabel}
                      </span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:30px 28px 10px;">
                <div style="font-size:14px;line-height:22px;color:#a1a1aa;">
                  Bonjour <strong style="color:#ffffff;">${safeGreetingName}</strong>,
                </div>

                <h1 style="margin:18px 0 0;font-size:27px;line-height:34px;letter-spacing:-0.8px;color:#ffffff;">
                  ${headline}
                </h1>

                <p style="margin:18px 0 0;font-size:15px;line-height:25px;color:#a1a1aa;">
                  ${statusMessage}
                </p>

                <p style="margin:13px 0 0;font-size:14px;line-height:24px;color:#71717a;">
                  ${mainMessage}
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:18px 28px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border:1px solid #1f2937;border-radius:15px;background:#050b0f;">
                  <tr>
                    <td style="padding:18px;">
                      <div style="font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#71717a;">
                        Formule
                      </div>
                      <div style="margin-top:6px;font-size:16px;font-weight:800;color:#ffffff;">
                        ${safePlanName}
                      </div>
                    </td>

                    <td style="padding:18px;border-left:1px solid #1f2937;">
                      <div style="font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#71717a;">
                        ${kind === "EXPIRED" ? "Expirée le" : "Expire le"}
                      </div>
                      <div style="margin-top:6px;font-size:14px;font-weight:800;color:${kind === "EXPIRED" ? "#fca5a5" : "#a3e635"};">
                        ${safeExpirationDate}
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:4px 28px 12px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="border-radius:12px;background:linear-gradient(90deg,#10b981,#84cc16,#f97316);">
                      <a href="${safeRenewalUrl}" style="display:inline-block;padding:14px 22px;font-size:14px;font-weight:900;color:#ffffff;text-decoration:none;">
                        ${kind === "EXPIRED" ? "Réactiver ma formule" : "Renouveler maintenant"}
                      </a>
                    </td>

                    <td style="padding-left:10px;">
                      <a href="${safePromotionsUrl}" style="display:inline-block;padding:13px 18px;border:1px solid #27272a;border-radius:12px;background:#0a1217;font-size:13px;font-weight:700;color:#d4d4d8;text-decoration:none;">
                        Gérer mes promotions
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:14px 28px 28px;">
                <div style="padding:15px 16px;border:1px solid #1e3a2f;border-radius:13px;background:rgba(16,185,129,.06);font-size:12px;line-height:20px;color:#9ca3af;">
                  <strong style="color:#a3e635;">Vos données restent intactes.</strong>
                  L’expiration ou la résiliation de votre formule ne supprime aucun événement, billet, commande, paiement ou rapport. Votre badge bleu organisateur reste également définitivement acquis après votre premier abonnement payé.
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:20px 28px;border-top:1px solid #1f2937;background:#050a0d;">
                <p style="margin:0;font-size:11px;line-height:19px;color:#52525b;">
                  Une question ? Écrivez-nous à
                  <a href="mailto:${safeSupportEmail}" style="color:#a3e635;text-decoration:none;">${safeSupportEmail}</a>.
                </p>

                <p style="margin:8px 0 0;font-size:10px;line-height:17px;color:#3f3f46;">
                  Cet email automatique concerne votre abonnement Visibilité Premium ${safeAppName}.
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

export async function sendPremiumExpirationEmail(
  input: SendPremiumExpirationEmailInput,
): Promise<SendPremiumExpirationEmailResult> {
  const to = normalizeEmail(input.to);

  if (!isValidEmail(to)) {
    throw new PremiumExpirationEmailError({
      code: "INVALID_RECIPIENT_EMAIL",
      status: 400,
      message:
        "L’adresse email du destinataire est invalide.",
    });
  }

  const planName =
    input.planName.trim();

  if (!planName) {
    throw new PremiumExpirationEmailError({
      code: "INVALID_PLAN_NAME",
      status: 400,
      message:
        "Le nom de la formule Premium est requis.",
    });
  }

  const expirationDate =
    parseDate(input.expirationDate);

  const kind: PremiumExpirationEmailKind =
    input.kind ??
    (expirationDate.getTime() <=
    Date.now()
      ? "EXPIRED"
      : "EXPIRING_SOON");

  const remainingDays =
    getRemainingDays(
      expirationDate,
      input.remainingDays,
    );

  const appName =
    getAppName();

  const greetingName =
    getGreetingName({
      firstName: input.firstName,
      organizerName:
        input.organizerName,
    });

  const supportEmail =
    getReplyTo(
      input.supportEmail,
    );

  const renewalUrl =
    buildAbsoluteUrl({
      providedUrl:
        input.renewalUrl,
      fallbackPath: input.subscriptionId
        ? `/organizer/promotions/checkout?subscriptionId=${encodeURIComponent(
            input.subscriptionId,
          )}&mode=renew`
        : "/organizer/promotions#premium-plans",
    });

  const promotionsUrl =
    buildAbsoluteUrl({
      providedUrl:
        input.promotionsUrl,
      fallbackPath:
        "/organizer/promotions",
    });

  const expirationDateLabel =
    formatDate(expirationDate);

  const subject =
    getSubject({
      kind,
      planName,
      remainingDays,
    });

  const text =
    buildTextEmail({
      appName,
      greetingName,
      planName,
      expirationDateLabel,
      kind,
      remainingDays,
      renewalUrl,
      promotionsUrl,
      supportEmail,
    });

  const html =
    buildHtmlEmail({
      appName,
      greetingName,
      planName,
      expirationDateLabel,
      kind,
      remainingDays,
      renewalUrl,
      promotionsUrl,
      supportEmail,
    });

  const resendApiKey =
    getRequiredEnvironmentVariable(
      "RESEND_API_KEY",
    );

  const resend =
    new Resend(resendApiKey);

  try {
    const response =
      await resend.emails.send({
        from: getMailFrom(),
        to,
        replyTo: supportEmail,
        subject,
        text,
        html,
        headers: {
          "X-Entity-Ref-ID":
            input.subscriptionId?.trim() ||
            `premium-expiration-${Date.now()}`,
        },
        tags: [
          {
            name: "category",
            value:
              "premium-subscription",
          },
          {
            name: "event",
            value:
              kind === "EXPIRED"
                ? "expired"
                : "expiring-soon",
          },
        ],
      });

    if (response.error) {
      console.error(
        "[SEND_PREMIUM_EXPIRATION_EMAIL_PROVIDER_ERROR]",
        {
          name:
            response.error.name,
          message:
            response.error.message,
        },
      );

      throw new PremiumExpirationEmailError({
        code:
          "PREMIUM_EXPIRATION_EMAIL_PROVIDER_ERROR",
        message:
          "Le service d’envoi d’emails a refusé le message.",
      });
    }

    return {
      success: true,
      messageId:
        response.data?.id ?? null,
    };
  } catch (error) {
    if (
      error instanceof
      PremiumExpirationEmailError
    ) {
      throw error;
    }

    console.error(
      "[SEND_PREMIUM_EXPIRATION_EMAIL_ERROR]",
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack:
              process.env.NODE_ENV ===
              "development"
                ? error.stack
                : undefined,
          }
        : error,
    );

    throw new PremiumExpirationEmailError({
      code:
        "SEND_PREMIUM_EXPIRATION_EMAIL_FAILED",
      message:
        "Impossible d’envoyer l’email d’expiration Premium pour le moment.",
    });
  }
}