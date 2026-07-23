import "server-only";

import { Resend } from "resend";

const DEFAULT_APP_NAME = "Tikemia";
const DEFAULT_APP_URL = "https://tikemia.com";
const DEFAULT_SUPPORT_EMAIL = "support@tikemia.com";

export type PremiumSubscriptionEmailKind =
  | "CREATED"
  | "ACTIVATED"
  | "RENEWED"
  | "CANCELLED"
  | "AUTO_RENEW_ENABLED"
  | "AUTO_RENEW_DISABLED";

export type SendPremiumSubscriptionEmailInput = {
  to: string;
  firstName?: string | null;
  organizerName?: string | null;

  kind: PremiumSubscriptionEmailKind;

  planName: string;
  price: number;
  currency: string;
  billingPeriodLabel?: string | null;

  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
  canceledAt?: Date | string | null;

  subscriptionId?: string | null;
  autoRenew?: boolean | null;
  maxBoostedEvents?: number | null;
  priorityScore?: number | null;
  blueBadgeGranted?: boolean | null;

  promotionsUrl?: string | null;
  checkoutUrl?: string | null;
  supportEmail?: string | null;
};

export type SendPremiumSubscriptionEmailResult = {
  success: true;
  messageId: string | null;
};

export class PremiumSubscriptionEmailError extends Error {
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

    this.name = "PremiumSubscriptionEmailError";
    this.code = code;
    this.status = status;
  }
}

type EmailPresentation = {
  subject: string;
  headline: string;
  badgeLabel: string;
  badgeBorderColor: string;
  badgeBackground: string;
  badgeTextColor: string;
  accentColor: string;
  primaryButtonLabel: string;
  statusMessage: string;
  detailMessage: string;
};

function getRequiredEnvironmentVariable(
  key: string,
): string {
  const value = process.env[key]?.trim();

  if (!value) {
    throw new PremiumSubscriptionEmailError({
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

function normalizeCurrency(
  value: string,
): string {
  const normalized =
    value.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new PremiumSubscriptionEmailError({
      code: "INVALID_CURRENCY",
      status: 400,
      message:
        "La devise de l’abonnement Premium est invalide.",
    });
  }

  return normalized;
}

function parseOptionalDate(
  value: Date | string | null | undefined,
  fieldName: string,
): Date | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed =
    value instanceof Date
      ? value
      : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new PremiumSubscriptionEmailError({
      code: "INVALID_SUBSCRIPTION_DATE",
      status: 400,
      message:
        `La date ${fieldName} de l’abonnement Premium est invalide.`,
    });
  }

  return parsed;
}

function formatDate(
  value: Date | null,
): string {
  if (!value) {
    return "Non définie";
  }

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

function formatMoney(
  value: number,
  currency: string,
): string {
  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style: "currency",
        currency,
        maximumFractionDigits:
          currency === "XOF" ? 0 : 2,
      },
    ).format(value);
  } catch {
    return `${value.toLocaleString(
      "fr-FR",
    )} ${currency}`;
  }
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
      // Une URL fournie invalide est remplacée par l’URL Tikemia sûre.
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

function getPresentation({
  kind,
  planName,
  endsAtLabel,
  canceledAtLabel,
  autoRenew,
}: {
  kind: PremiumSubscriptionEmailKind;
  planName: string;
  endsAtLabel: string;
  canceledAtLabel: string;
  autoRenew: boolean | null;
}): EmailPresentation {
  switch (kind) {
    case "CREATED":
      return {
        subject:
          `Votre demande d’abonnement Premium ${planName} a été créée`,
        headline:
          "Votre demande Premium est prête",
        badgeLabel:
          "Paiement en attente",
        badgeBorderColor:
          "#075985",
        badgeBackground:
          "rgba(14,165,233,.10)",
        badgeTextColor:
          "#7dd3fc",
        accentColor:
          "#38bdf8",
        primaryButtonLabel:
          "Finaliser le paiement",
        statusMessage:
          `Votre demande pour la formule « ${planName} » a été enregistrée avec succès.`,
        detailMessage:
          "L’abonnement sera activé automatiquement dès que le paiement sera confirmé.",
      };

    case "ACTIVATED":
      return {
        subject:
          `Votre abonnement Premium ${planName} est actif`,
        headline:
          "Votre Visibilité Premium est active",
        badgeLabel:
          "Abonnement actif",
        badgeBorderColor:
          "#065f46",
        badgeBackground:
          "rgba(16,185,129,.10)",
        badgeTextColor:
          "#a3e635",
        accentColor:
          "#a3e635",
        primaryButtonLabel:
          "Promouvoir un événement",
        statusMessage:
          `Votre formule « ${planName} » est maintenant active.`,
        detailMessage:
          endsAtLabel === "Non définie"
            ? "Vous pouvez dès maintenant sélectionner les événements à promouvoir."
            : `Votre formule reste active jusqu’au ${endsAtLabel}.`,
      };

    case "RENEWED":
      return {
        subject:
          `Votre abonnement Premium ${planName} a été renouvelé`,
        headline:
          "Votre abonnement Premium est renouvelé",
        badgeLabel:
          "Renouvellement confirmé",
        badgeBorderColor:
          "#065f46",
        badgeBackground:
          "rgba(16,185,129,.10)",
        badgeTextColor:
          "#a3e635",
        accentColor:
          "#a3e635",
        primaryButtonLabel:
          "Gérer mes promotions",
        statusMessage:
          `Le renouvellement de votre formule « ${planName} » a été confirmé.`,
        detailMessage:
          endsAtLabel === "Non définie"
            ? "Votre visibilité continue sans interruption."
            : `Votre nouvelle période se termine le ${endsAtLabel}.`,
      };

    case "CANCELLED":
      return {
        subject:
          `Votre abonnement Premium ${planName} a été résilié`,
        headline:
          "Votre abonnement Premium a été résilié",
        badgeLabel:
          "Abonnement résilié",
        badgeBorderColor:
          "#7f1d1d",
        badgeBackground:
          "rgba(239,68,68,.10)",
        badgeTextColor:
          "#fca5a5",
        accentColor:
          "#f87171",
        primaryButtonLabel:
          "Voir les formules Premium",
        statusMessage:
          `Votre formule « ${planName} » a été résiliée${canceledAtLabel === "Non définie" ? "" : ` le ${canceledAtLabel}`}.`,
        detailMessage:
          "Vos événements, billets, commandes, paiements et rapports restent entièrement conservés.",
      };

    case "AUTO_RENEW_ENABLED":
      return {
        subject:
          `Renouvellement automatique activé pour ${planName}`,
        headline:
          "Renouvellement automatique activé",
        badgeLabel:
          "Auto-renouvellement actif",
        badgeBorderColor:
          "#065f46",
        badgeBackground:
          "rgba(16,185,129,.10)",
        badgeTextColor:
          "#a3e635",
        accentColor:
          "#a3e635",
        primaryButtonLabel:
          "Gérer mon abonnement",
        statusMessage:
          `Le renouvellement automatique de la formule « ${planName} » est maintenant activé.`,
        detailMessage:
          autoRenew
            ? "Votre abonnement pourra être renouvelé automatiquement à la fin de la période."
            : "Le renouvellement automatique a été activé.",
      };

    case "AUTO_RENEW_DISABLED":
      return {
        subject:
          `Renouvellement automatique désactivé pour ${planName}`,
        headline:
          "Renouvellement automatique désactivé",
        badgeLabel:
          "Renouvellement manuel",
        badgeBorderColor:
          "#854d0e",
        badgeBackground:
          "rgba(249,115,22,.10)",
        badgeTextColor:
          "#fdba74",
        accentColor:
          "#fb923c",
        primaryButtonLabel:
          "Gérer mon abonnement",
        statusMessage:
          `Le renouvellement automatique de la formule « ${planName} » est désactivé.`,
        detailMessage:
          endsAtLabel === "Non définie"
            ? "Vous pourrez renouveler manuellement votre abonnement depuis votre espace organisateur."
            : `Votre formule reste active jusqu’au ${endsAtLabel}.`,
      };
  }
}

function buildTextEmail({
  appName,
  greetingName,
  presentation,
  planName,
  formattedPrice,
  billingPeriodLabel,
  startsAtLabel,
  endsAtLabel,
  maxBoostedEvents,
  priorityScore,
  autoRenew,
  blueBadgeGranted,
  primaryUrl,
  promotionsUrl,
  supportEmail,
}: {
  appName: string;
  greetingName: string;
  presentation: EmailPresentation;
  planName: string;
  formattedPrice: string;
  billingPeriodLabel: string;
  startsAtLabel: string;
  endsAtLabel: string;
  maxBoostedEvents: number | null;
  priorityScore: number | null;
  autoRenew: boolean | null;
  blueBadgeGranted: boolean;
  primaryUrl: string;
  promotionsUrl: string;
  supportEmail: string;
}): string {
  const lines = [
    `Bonjour ${greetingName},`,
    "",
    presentation.statusMessage,
    presentation.detailMessage,
    "",
    `Formule : ${planName}`,
    `Prix : ${formattedPrice}`,
    `Facturation : ${billingPeriodLabel}`,
    `Début : ${startsAtLabel}`,
    `Fin : ${endsAtLabel}`,
  ];

  if (
    typeof maxBoostedEvents ===
    "number"
  ) {
    lines.push(
      `Événements promus inclus : ${maxBoostedEvents}`,
    );
  }

  if (
    typeof priorityScore ===
    "number"
  ) {
    lines.push(
      `Score de priorité : ${priorityScore}`,
    );
  }

  if (autoRenew !== null) {
    lines.push(
      `Renouvellement automatique : ${
        autoRenew
          ? "Activé"
          : "Désactivé"
      }`,
    );
  }

  if (blueBadgeGranted) {
    lines.push(
      "",
      "Votre badge bleu organisateur a été attribué définitivement.",
    );
  }

  lines.push(
    "",
    `${presentation.primaryButtonLabel} : ${primaryUrl}`,
    `Gérer mes promotions : ${promotionsUrl}`,
    "",
    "L’abonnement Premium ne supprime ni ne modifie vos événements, billets, commandes ou paiements.",
    "",
    `Besoin d’aide ? Contactez-nous à ${supportEmail}.`,
    "",
    `L’équipe ${appName}`,
  );

  return lines.join("\n");
}

function buildHtmlEmail({
  appName,
  greetingName,
  presentation,
  planName,
  formattedPrice,
  billingPeriodLabel,
  startsAtLabel,
  endsAtLabel,
  maxBoostedEvents,
  priorityScore,
  autoRenew,
  blueBadgeGranted,
  primaryUrl,
  promotionsUrl,
  supportEmail,
}: {
  appName: string;
  greetingName: string;
  presentation: EmailPresentation;
  planName: string;
  formattedPrice: string;
  billingPeriodLabel: string;
  startsAtLabel: string;
  endsAtLabel: string;
  maxBoostedEvents: number | null;
  priorityScore: number | null;
  autoRenew: boolean | null;
  blueBadgeGranted: boolean;
  primaryUrl: string;
  promotionsUrl: string;
  supportEmail: string;
}): string {
  const safeAppName =
    escapeHtml(appName);
  const safeGreetingName =
    escapeHtml(greetingName);
  const safePlanName =
    escapeHtml(planName);
  const safeFormattedPrice =
    escapeHtml(formattedPrice);
  const safeBillingPeriodLabel =
    escapeHtml(billingPeriodLabel);
  const safeStartsAtLabel =
    escapeHtml(startsAtLabel);
  const safeEndsAtLabel =
    escapeHtml(endsAtLabel);
  const safePrimaryUrl =
    escapeHtml(primaryUrl);
  const safePromotionsUrl =
    escapeHtml(promotionsUrl);
  const safeSupportEmail =
    escapeHtml(supportEmail);

  const metricRows = [
    typeof maxBoostedEvents ===
    "number"
      ? `
        <td width="50%" style="padding:15px 16px;border-top:1px solid #1f2937;">
          <div style="font-size:10px;font-weight:800;letter-spacing:.9px;text-transform:uppercase;color:#71717a;">
            Événements promus
          </div>
          <div style="margin-top:6px;font-size:15px;font-weight:900;color:#ffffff;">
            ${maxBoostedEvents}
          </div>
        </td>
      `
      : "",
    typeof priorityScore ===
    "number"
      ? `
        <td width="50%" style="padding:15px 16px;border-top:1px solid #1f2937;border-left:1px solid #1f2937;">
          <div style="font-size:10px;font-weight:800;letter-spacing:.9px;text-transform:uppercase;color:#71717a;">
            Score de priorité
          </div>
          <div style="margin-top:6px;font-size:15px;font-weight:900;color:#c4b5fd;">
            ${priorityScore}
          </div>
        </td>
      `
      : "",
  ].join("");

  const autoRenewBlock =
    autoRenew === null
      ? ""
      : `
        <tr>
          <td colspan="2" style="padding:14px 16px;border-top:1px solid #1f2937;">
            <div style="font-size:11px;line-height:19px;color:#a1a1aa;">
              Renouvellement automatique :
              <strong style="color:${autoRenew ? "#a3e635" : "#fb923c"};">
                ${autoRenew ? "Activé" : "Désactivé"}
              </strong>
            </div>
          </td>
        </tr>
      `;

  const blueBadgeBlock =
    blueBadgeGranted
      ? `
        <tr>
          <td style="padding:0 28px 16px;">
            <div style="padding:15px 16px;border:1px solid #1d4ed8;border-radius:13px;background:rgba(59,130,246,.08);font-size:12px;line-height:20px;color:#bfdbfe;">
              <strong style="color:#93c5fd;">Badge bleu permanent attribué.</strong>
              Votre profil organisateur conserve ce badge même après l’expiration ou la résiliation de votre formule Premium.
            </div>
          </td>
        </tr>
      `
      : "";

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
    <title>${escapeHtml(presentation.headline)}</title>
  </head>

  <body style="margin:0;padding:0;background:#020609;font-family:Arial,Helvetica,sans-serif;color:#d4d4d8;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${escapeHtml(presentation.statusMessage)}
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
                      <span style="display:inline-block;padding:7px 11px;border-radius:999px;border:1px solid ${presentation.badgeBorderColor};background:${presentation.badgeBackground};font-size:10px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:${presentation.badgeTextColor};">
                        ${escapeHtml(presentation.badgeLabel)}
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
                  ${escapeHtml(presentation.headline)}
                </h1>

                <p style="margin:18px 0 0;font-size:15px;line-height:25px;color:#a1a1aa;">
                  ${escapeHtml(presentation.statusMessage)}
                </p>

                <p style="margin:12px 0 0;font-size:14px;line-height:24px;color:#71717a;">
                  ${escapeHtml(presentation.detailMessage)}
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:18px 28px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border:1px solid #1f2937;border-radius:15px;background:#050b0f;overflow:hidden;">
                  <tr>
                    <td width="50%" style="padding:18px;">
                      <div style="font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#71717a;">
                        Formule
                      </div>
                      <div style="margin-top:6px;font-size:16px;font-weight:900;color:#ffffff;">
                        ${safePlanName}
                      </div>
                    </td>

                    <td width="50%" style="padding:18px;border-left:1px solid #1f2937;">
                      <div style="font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#71717a;">
                        Prix
                      </div>
                      <div style="margin-top:6px;font-size:16px;font-weight:900;color:${presentation.accentColor};">
                        ${safeFormattedPrice}
                      </div>
                      <div style="margin-top:4px;font-size:10px;color:#71717a;">
                        ${safeBillingPeriodLabel}
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td width="50%" style="padding:15px 16px;border-top:1px solid #1f2937;">
                      <div style="font-size:10px;font-weight:800;letter-spacing:.9px;text-transform:uppercase;color:#71717a;">
                        Début
                      </div>
                      <div style="margin-top:6px;font-size:13px;font-weight:800;color:#ffffff;">
                        ${safeStartsAtLabel}
                      </div>
                    </td>

                    <td width="50%" style="padding:15px 16px;border-top:1px solid #1f2937;border-left:1px solid #1f2937;">
                      <div style="font-size:10px;font-weight:800;letter-spacing:.9px;text-transform:uppercase;color:#71717a;">
                        Fin
                      </div>
                      <div style="margin-top:6px;font-size:13px;font-weight:800;color:#ffffff;">
                        ${safeEndsAtLabel}
                      </div>
                    </td>
                  </tr>

                  ${
                    metricRows
                      ? `<tr>${metricRows}</tr>`
                      : ""
                  }

                  ${autoRenewBlock}
                </table>
              </td>
            </tr>

            ${blueBadgeBlock}

            <tr>
              <td style="padding:4px 28px 12px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="border-radius:12px;background:linear-gradient(90deg,#10b981,#84cc16,#f97316);">
                      <a href="${safePrimaryUrl}" style="display:inline-block;padding:14px 22px;font-size:14px;font-weight:900;color:#ffffff;text-decoration:none;">
                        ${escapeHtml(presentation.primaryButtonLabel)}
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
                  <strong style="color:#a3e635;">Vos données restent protégées.</strong>
                  Les changements liés à l’abonnement Premium ne suppriment aucun événement, billet, commande, paiement ou rapport.
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

export async function sendPremiumSubscriptionEmail(
  input: SendPremiumSubscriptionEmailInput,
): Promise<SendPremiumSubscriptionEmailResult> {
  const to =
    normalizeEmail(input.to);

  if (!isValidEmail(to)) {
    throw new PremiumSubscriptionEmailError({
      code: "INVALID_RECIPIENT_EMAIL",
      status: 400,
      message:
        "L’adresse email du destinataire est invalide.",
    });
  }

  const planName =
    input.planName.trim();

  if (!planName) {
    throw new PremiumSubscriptionEmailError({
      code: "INVALID_PLAN_NAME",
      status: 400,
      message:
        "Le nom de la formule Premium est requis.",
    });
  }

  if (
    !Number.isFinite(input.price) ||
    input.price < 0
  ) {
    throw new PremiumSubscriptionEmailError({
      code: "INVALID_SUBSCRIPTION_PRICE",
      status: 400,
      message:
        "Le prix de l’abonnement Premium est invalide.",
    });
  }

  const currency =
    normalizeCurrency(
      input.currency,
    );

  const startsAt =
    parseOptionalDate(
      input.startsAt,
      "de début",
    );

  const endsAt =
    parseOptionalDate(
      input.endsAt,
      "de fin",
    );

  const canceledAt =
    parseOptionalDate(
      input.canceledAt,
      "de résiliation",
    );

  const startsAtLabel =
    formatDate(startsAt);
  const endsAtLabel =
    formatDate(endsAt);
  const canceledAtLabel =
    formatDate(canceledAt);

  const billingPeriodLabel =
    input.billingPeriodLabel
      ?.trim() ||
    "Période Premium";

  const presentation =
    getPresentation({
      kind: input.kind,
      planName,
      endsAtLabel,
      canceledAtLabel,
      autoRenew:
        input.autoRenew ?? null,
    });

  const appName =
    getAppName();

  const greetingName =
    getGreetingName({
      firstName:
        input.firstName,
      organizerName:
        input.organizerName,
    });

  const supportEmail =
    getReplyTo(
      input.supportEmail,
    );

  const promotionsUrl =
    buildAbsoluteUrl({
      providedUrl:
        input.promotionsUrl,
      fallbackPath:
        "/organizer/promotions",
    });

  const checkoutUrl =
    buildAbsoluteUrl({
      providedUrl:
        input.checkoutUrl,
      fallbackPath:
        input.subscriptionId
          ? `/organizer/promotions/checkout?subscriptionId=${encodeURIComponent(
              input.subscriptionId,
            )}`
          : "/organizer/promotions#premium-plans",
    });

  const primaryUrl =
    input.kind === "CREATED"
      ? checkoutUrl
      : promotionsUrl;

  const formattedPrice =
    formatMoney(
      input.price,
      currency,
    );

  const text =
    buildTextEmail({
      appName,
      greetingName,
      presentation,
      planName,
      formattedPrice,
      billingPeriodLabel,
      startsAtLabel,
      endsAtLabel,
      maxBoostedEvents:
        typeof input.maxBoostedEvents ===
        "number"
          ? Math.max(
              0,
              Math.floor(
                input.maxBoostedEvents,
              ),
            )
          : null,
      priorityScore:
        typeof input.priorityScore ===
        "number"
          ? Math.max(
              0,
              Math.floor(
                input.priorityScore,
              ),
            )
          : null,
      autoRenew:
        input.autoRenew ?? null,
      blueBadgeGranted:
        input.blueBadgeGranted ===
        true,
      primaryUrl,
      promotionsUrl,
      supportEmail,
    });

  const html =
    buildHtmlEmail({
      appName,
      greetingName,
      presentation,
      planName,
      formattedPrice,
      billingPeriodLabel,
      startsAtLabel,
      endsAtLabel,
      maxBoostedEvents:
        typeof input.maxBoostedEvents ===
        "number"
          ? Math.max(
              0,
              Math.floor(
                input.maxBoostedEvents,
              ),
            )
          : null,
      priorityScore:
        typeof input.priorityScore ===
        "number"
          ? Math.max(
              0,
              Math.floor(
                input.priorityScore,
              ),
            )
          : null,
      autoRenew:
        input.autoRenew ?? null,
      blueBadgeGranted:
        input.blueBadgeGranted ===
        true,
      primaryUrl,
      promotionsUrl,
      supportEmail,
    });

  const resend =
    new Resend(
      getRequiredEnvironmentVariable(
        "RESEND_API_KEY",
      ),
    );

  try {
    const response =
      await resend.emails.send({
        from: getMailFrom(),
        to,
        replyTo: supportEmail,
        subject:
          presentation.subject,
        text,
        html,
        headers: {
          "X-Entity-Ref-ID":
            input.subscriptionId
              ?.trim() ||
            `premium-subscription-${Date.now()}`,
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
              input.kind
                .toLowerCase()
                .replaceAll("_", "-"),
          },
        ],
      });

    if (response.error) {
      console.error(
        "[SEND_PREMIUM_SUBSCRIPTION_EMAIL_PROVIDER_ERROR]",
        {
          name:
            response.error.name,
          message:
            response.error.message,
        },
      );

      throw new PremiumSubscriptionEmailError({
        code:
          "PREMIUM_SUBSCRIPTION_EMAIL_PROVIDER_ERROR",
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
      PremiumSubscriptionEmailError
    ) {
      throw error;
    }

    console.error(
      "[SEND_PREMIUM_SUBSCRIPTION_EMAIL_ERROR]",
      error instanceof Error
        ? {
            name: error.name,
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

    throw new PremiumSubscriptionEmailError({
      code:
        "SEND_PREMIUM_SUBSCRIPTION_EMAIL_FAILED",
      message:
        "Impossible d’envoyer l’email d’abonnement Premium pour le moment.",
    });
  }
}