import { currencyDecimals } from "@/i18n/config";

import "server-only";

/**
 * ============================================================
 * TIKEMIA — EMAIL TEMPLATES
 * ============================================================
 *
 * src/lib/email/templates.ts
 *
 * Emails :
 * - Confirmation d'achat de billets
 * - Confirmation de don
 *
 * Langues :
 * - Français (par défaut)
 * - Anglais
 *
 * Fonctionnement :
 * - HTML responsive
 * - Version texte
 * - Données dynamiques validées
 * - Protection contre l'injection HTML
 * - Montants en unités mineures
 * - Dates selon le fuseau horaire de l'événement
 * - Aucun secret exposé
 * - Aucun envoi effectué dans ce fichier
 *
 * Les PDF seront ajoutés comme pièces jointes
 * dans src/lib/email/send.ts.
 * ============================================================
 */

/* ============================================================
   TYPES
============================================================ */

export type EmailLocale = "fr" | "en";

export type EmailTemplateName =
  | "ticket_purchase"
  | "donation_confirmation";

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

export type TicketEmailItem = {
  ticketNumber: string;
  category?: string | null;
};

export type TicketPurchaseEmailData = {
  locale?: EmailLocale;

  recipientEmail: string;
  holderEmail: string;
  holderPhone: string;
  holderName?: string | null;

  orderReference: string;

  eventTitle: string;
  eventStartsAt: Date | string;
  eventTimeZone: string;
  eventVenue?: string | null;

  tickets: readonly TicketEmailItem[];

  totalMinor: string;
  currency: string;

  /**
   * Facultatif.
   *
   * Adresse absolue HTTPS de l'espace billets.
   * Aucune URL contenant un token privé.
   */
  ticketsUrl?: string | null;

  /**
   * Logo officiel TIKEMIA accessible publiquement.
   * URL HTTPS absolue.
   */
  logoUrl?: string | null;
};

export type DonationConfirmationEmailData = {
  locale?: EmailLocale;

  recipientEmail: string;
  donorName?: string | null;

  donationReference: string;
  campaignTitle: string;

  amountMinor: string;
  currency: string;

  confirmedAt: Date | string;

  /**
   * Total payé, frais compris.
   * Facultatif.
   */
  totalPaidMinor?: string | null;

  /**
   * URL publique HTTPS de la cagnotte.
   */
  campaignUrl?: string | null;

  logoUrl?: string | null;
};

export class EmailTemplateError extends Error {
  constructor(
    public readonly code: string
  ) {
    super(code);
    this.name = "EmailTemplateError";
  }
}

/* ============================================================
   CONFIGURATION VISUELLE
============================================================ */

const COLORS = {
  green: "#07852d",
  greenDark: "#056622",
  greenLight: "#eef9f0",

  navy: "#142238",
  text: "#263648",
  secondary: "#667589",

  white: "#ffffff",
  background: "#f5f8f6",
  border: "#e0e9e2",
} as const;

const MAX_TICKETS = 1000;

const MAX_TEXT_LENGTH = 500;

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const AMOUNT_PATTERN =
  /^(0|[1-9][0-9]{0,18})$/;

const CURRENCY_PATTERN =
  /^[A-Z]{3}$/;

/* ============================================================
   TRADUCTIONS
============================================================ */

const TRANSLATIONS = {
  fr: {
    brand: "TIKEMIA",
    slogan: "Vivez vos événements autrement",

    ticketSubject:
      "Vos billets TIKEMIA sont confirmés",

    donationSubject:
      "Confirmation de votre don TIKEMIA",

    greeting: "Bonjour,",

    ticketTitle:
      "Vos billets sont confirmés",

    ticketIntro:
      "Votre paiement a été confirmé. Retrouvez les informations de votre événement ci-dessous.",

    event: "Événement",
    date: "Date",
    time: "Heure",
    venue: "Lieu",
    holder: "Titulaire",
    email: "Email",
    phone: "Téléphone",
    category: "Catégorie",

    tickets: "Billets",
    ticket: "Billet",
    quantity: "Nombre de billets",
    totalPaid: "Total payé",
    reference: "Référence",

    ticketAttachment:
      "Vos billets électroniques avec QR codes uniques sont joints à cet email au format PDF.",

    ticketInstruction:
      "Présentez le QR code de chaque billet à l'entrée de l'événement.",

    ticketScan:
      "Chaque billet est valable pour une seule entrée.",

    viewTickets: "Accéder à mes billets",

    donationTitle:
      "Votre don est confirmé",

    donationIntro:
      "Merci pour votre contribution. Votre don a bien été enregistré après confirmation du paiement.",

    campaign: "Cagnotte",
    donationAmount: "Montant du don",
    donationDate: "Date de confirmation",

    donationThankYou:
      "Merci pour votre générosité et votre soutien.",

    viewCampaign: "Voir la cagnotte",

    help:
      "Cet email est une confirmation automatique envoyée par TIKEMIA.",

    footer:
      "TIKEMIA — Billetterie et cagnottes en ligne",

    noVenue: "Lieu à confirmer",

    ticketNumber: "N° de billet",
  },

  en: {
    brand: "TIKEMIA",
    slogan: "Experience events differently",

    ticketSubject:
      "Your TIKEMIA tickets are confirmed",

    donationSubject:
      "Your TIKEMIA donation confirmation",

    greeting: "Hello,",

    ticketTitle:
      "Your tickets are confirmed",

    ticketIntro:
      "Your payment has been confirmed. Your event details are listed below.",

    event: "Event",
    date: "Date",
    time: "Time",
    venue: "Venue",
    holder: "Ticket holder",
    email: "Email",
    phone: "Phone",
    category: "Category",

    tickets: "Tickets",
    ticket: "Ticket",
    quantity: "Number of tickets",
    totalPaid: "Total paid",
    reference: "Reference",

    ticketAttachment:
      "Your electronic tickets, each with a unique QR code, are attached to this email as PDF files.",

    ticketInstruction:
      "Present each ticket's QR code at the event entrance.",

    ticketScan:
      "Each ticket is valid for one entry only.",

    viewTickets: "View my tickets",

    donationTitle:
      "Your donation is confirmed",

    donationIntro:
      "Thank you for your contribution. Your donation has been recorded after payment confirmation.",

    campaign: "Fundraiser",
    donationAmount: "Donation amount",
    donationDate: "Confirmation date",

    donationThankYou:
      "Thank you for your generosity and support.",

    viewCampaign: "View fundraiser",

    help:
      "This is an automated confirmation email from TIKEMIA.",

    footer:
      "TIKEMIA — Online ticketing and fundraising",

    noVenue: "Venue to be confirmed",

    ticketNumber: "Ticket number",
  },
} as const;

/* ============================================================
   VALIDATIONS
============================================================ */

function normalizeLocale(
  value?: EmailLocale
): EmailLocale {
  return value === "en" ? "en" : "fr";
}

function requiredText(
  value: unknown,
  field: string,
  maximumLength = MAX_TEXT_LENGTH
): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > maximumLength
  ) {
    throw new EmailTemplateError(
      `INVALID_${field}`
    );
  }

  return value.trim();
}

function optionalText(
  value: string | null | undefined,
  maximumLength = MAX_TEXT_LENGTH
): string | null {
  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    return null;
  }

  const result = value.trim();

  if (result.length > maximumLength) {
    throw new EmailTemplateError(
      "TEXT_TOO_LONG"
    );
  }

  return result;
}

function validateEmail(
  value: string
): string {
  const email =
    requiredText(
      value,
      "EMAIL",
      254
    ).toLowerCase();

  if (!EMAIL_PATTERN.test(email)) {
    throw new EmailTemplateError(
      "INVALID_EMAIL"
    );
  }

  return email;
}

function validatePhone(
  value: string
): string {
  const phone =
    requiredText(
      value,
      "PHONE",
      24
    );

  if (
    !/^\+[1-9][0-9]{6,14}$/.test(phone)
  ) {
    throw new EmailTemplateError(
      "INVALID_PHONE"
    );
  }

  return phone;
}

function validateCurrency(
  value: string
): string {
  const currency =
    requiredText(
      value,
      "CURRENCY",
      3
    ).toUpperCase();

  if (
    !CURRENCY_PATTERN.test(currency)
  ) {
    throw new EmailTemplateError(
      "INVALID_CURRENCY"
    );
  }

  return currency;
}

function parseAmount(
  value: string
): bigint {
  if (
    typeof value !== "string" ||
    !AMOUNT_PATTERN.test(value)
  ) {
    throw new EmailTemplateError(
      "INVALID_AMOUNT"
    );
  }

  const amount = BigInt(value);

  if (
    amount >
    9_223_372_036_854_775_807n
  ) {
    throw new EmailTemplateError(
      "AMOUNT_OUT_OF_RANGE"
    );
  }

  return amount;
}

/* ============================================================
   PRÉCISION DES DEVISES
============================================================ */

/**
 * Les montants transmis sont en unités mineures,
 * comme dans les modèles Prisma de TIKEMIA.
 *
 * La précision est fournie par Intl.
 * Aucun calcul financier en virgule flottante.
 */

function currencyDigits(
  currency: string
): number {
  try {
    return currencyDecimals(currency);
  } catch {
    throw new EmailTemplateError(
      "UNSUPPORTED_CURRENCY"
    );
  }
}

function formatAmount(
  amountMinor: string,
  currency: string,
  locale: EmailLocale
): string {
  const code =
    validateCurrency(currency);

  const amount =
    parseAmount(amountMinor);

  const digits =
    currencyDigits(code);

  const divisor =
    10n ** BigInt(digits);

  const integerPart =
    amount / divisor;

  const fractionalPart =
    amount % divisor;

  const numberLocale =
    locale === "fr"
      ? "fr-FR"
      : "en-US";

  const integerText =
    new Intl.NumberFormat(
      numberLocale
    ).format(integerPart);

  const decimalSeparator =
    new Intl.NumberFormat(
      numberLocale
    )
      .formatToParts(1.1)
      .find(
        (part) =>
          part.type === "decimal"
      )?.value ?? ".";

  const numberText =
    digits === 0
      ? integerText
      : [
          integerText,
          decimalSeparator,
          fractionalPart
            .toString()
            .padStart(digits, "0"),
        ].join("");

  const symbol =
    code === "XOF"
      ? "FCFA"
      : code;

  return `${numberText} ${symbol}`;
}

/* ============================================================
   DATES ET FUSEAUX HORAIRES
============================================================ */

function parseDate(
  value: Date | string
): Date {
  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    throw new EmailTemplateError(
      "INVALID_DATE"
    );
  }

  return date;
}

function formatDateTime(
  value: Date | string,
  timeZone: string,
  locale: EmailLocale
): {
  date: string;
  time: string;
} {
  const date =
    parseDate(value);

  const language =
    locale === "fr"
      ? "fr-FR"
      : "en-GB";

  try {
    return {
      date:
        new Intl.DateTimeFormat(
          language,
          {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone,
          }
        ).format(date),

      time:
        new Intl.DateTimeFormat(
          language,
          {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZone,
          }
        ).format(date),
    };
  } catch {
    throw new EmailTemplateError(
      "INVALID_TIMEZONE"
    );
  }
}

function formatConfirmationDate(
  value: Date | string,
  locale: EmailLocale
): string {
  return new Intl.DateTimeFormat(
    locale === "fr"
      ? "fr-FR"
      : "en-GB",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }
  ).format(parseDate(value));
}

/* ============================================================
   PROTECTION HTML
============================================================ */

function escapeHtml(
  value: string
): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ============================================================
   URL SÉCURISÉE
============================================================ */

function safeHttpsUrl(
  value: string | null | undefined
): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.hash ||
      url.search
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

/* ============================================================
   LIGNES D'INFORMATIONS
============================================================ */

function detailRow(
  label: string,
  value: string
): string {
  return `
    <tr>
      <td
        style="
          padding:10px 0;
          vertical-align:top;
          width:38%;
          color:${COLORS.secondary};
          font-size:13px;
          line-height:20px;
        "
      >
        ${escapeHtml(label)}
      </td>

      <td
        style="
          padding:10px 0;
          vertical-align:top;
          color:${COLORS.navy};
          font-size:13px;
          line-height:20px;
          font-weight:700;
          overflow-wrap:anywhere;
          word-break:break-word;
        "
      >
        ${escapeHtml(value)}
      </td>
    </tr>
  `;
}

function detailsTable(
  rows: Array<{
    label: string;
    value: string;
  }>
): string {
  return `
    <table
      role="presentation"
      cellspacing="0"
      cellpadding="0"
      border="0"
      width="100%"
      style="border-collapse:collapse;"
    >
      ${rows
        .map(
          (row) =>
            detailRow(
              row.label,
              row.value
            )
        )
        .join("")}
    </table>
  `;
}

/* ============================================================
   BOUTON EMAIL
============================================================ */

function emailButton(
  label: string,
  url: string | null
): string {
  if (!url) {
    return "";
  }

  return `
    <table
      role="presentation"
      align="center"
      cellspacing="0"
      cellpadding="0"
      border="0"
      style="margin:24px auto 0;"
    >
      <tr>
        <td
          align="center"
          bgcolor="${COLORS.green}"
          style="border-radius:28px;"
        >
          <a
            href="${escapeHtml(url)}"
            target="_blank"
            rel="noopener noreferrer"
            style="
              display:inline-block;
              padding:15px 26px;
              background:${COLORS.green};
              border-radius:28px;
              color:#ffffff;
              text-decoration:none;
              font-size:14px;
              font-weight:700;
            "
          >
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>
  `;
}

/* ============================================================
   STRUCTURE HTML EMAIL
============================================================ */

/**
 * Email HTML compatible avec les principaux
 * logiciels de messagerie.
 *
 * Structure par tableaux pour la compatibilité
 * avec Gmail, Outlook et les applications mobiles.
 *
 * Aucun JavaScript.
 * Aucun composant React.
 * Aucune dépendance externe.
 */

function emailLayout(input: {
  locale: EmailLocale;
  title: string;
  preheader: string;
  content: string;
  logoUrl?: string | null;
}): string {
  const t =
    TRANSLATIONS[input.locale];

  const logoUrl =
    safeHttpsUrl(input.logoUrl);

  const logoHtml = logoUrl
    ? `
      <img
        src="${escapeHtml(logoUrl)}"
        width="190"
        alt="TIKEMIA"
        border="0"
        style="
          display:block;
          width:190px;
          max-width:100%;
          height:auto;
          border:0;
        "
      />
    `
    : `
      <span
        style="
          font-size:32px;
          font-weight:900;
          letter-spacing:-1px;
          color:${COLORS.green};
        "
      >
        TIKEMIA
      </span>
    `;

  return `<!DOCTYPE html>
<html lang="${input.locale}">
<head>
  <meta charset="UTF-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  />

  <meta
    name="color-scheme"
    content="light"
  />

  <title>${escapeHtml(input.title)}</title>

  <style>
    @media only screen and (max-width: 600px) {
      .tikemia-container {
        width: 100% !important;
      }

      .tikemia-content {
        padding: 24px 18px !important;
      }

      .tikemia-heading {
        font-size: 23px !important;
        line-height: 30px !important;
      }

      .tikemia-header {
        padding: 24px 18px !important;
      }

      .tikemia-card {
        padding: 17px !important;
      }
    }
  </style>
</head>

<body
  style="
    margin:0;
    padding:0;
    background:${COLORS.background};
    font-family:Arial,Helvetica,sans-serif;
    -webkit-text-size-adjust:100%;
  "
>
  <div
    style="
      display:none;
      font-size:1px;
      color:${COLORS.background};
      line-height:1px;
      max-height:0;
      max-width:0;
      opacity:0;
      overflow:hidden;
    "
  >
    ${escapeHtml(input.preheader)}
  </div>

  <table
    role="presentation"
    width="100%"
    cellspacing="0"
    cellpadding="0"
    border="0"
    bgcolor="${COLORS.background}"
    style="border-collapse:collapse;"
  >
    <tr>
      <td
        align="center"
        style="padding:28px 12px;"
      >

        <table
          role="presentation"
          class="tikemia-container"
          width="600"
          cellspacing="0"
          cellpadding="0"
          border="0"
          bgcolor="#ffffff"
          style="
            width:600px;
            max-width:100%;
            border-collapse:separate;
            border-spacing:0;
            background:#ffffff;
            border:1px solid ${COLORS.border};
            border-radius:18px;
            overflow:hidden;
          "
        >

          <tr>
            <td
              class="tikemia-header"
              style="
                padding:28px 32px;
                background:#ffffff;
                border-bottom:3px solid ${COLORS.green};
              "
            >
              ${logoHtml}
            </td>
          </tr>

          <tr>
            <td
              class="tikemia-content"
              style="
                padding:32px;
                color:${COLORS.text};
              "
            >
              ${input.content}
            </td>
          </tr>

          <tr>
            <td
              align="center"
              style="
                padding:24px 22px;
                background:${COLORS.greenLight};
                border-top:1px solid ${COLORS.border};
              "
            >
              <p
                style="
                  margin:0 0 7px;
                  color:${COLORS.greenDark};
                  font-size:15px;
                  font-weight:800;
                "
              >
                ${escapeHtml(t.brand)}
              </p>

              <p
                style="
                  margin:0 0 10px;
                  color:${COLORS.greenDark};
                  font-size:12px;
                "
              >
                ${escapeHtml(t.slogan)}
              </p>

              <p
                style="
                  margin:0;
                  color:${COLORS.secondary};
                  font-size:11px;
                  line-height:17px;
                "
              >
                ${escapeHtml(t.help)}
              </p>
            </td>
          </tr>

          <tr>
            <td
              align="center"
              style="
                padding:15px;
                background:${COLORS.greenDark};
                color:#ffffff;
                font-size:11px;
              "
            >
              ${escapeHtml(t.footer)}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/* ============================================================
   CONFIRMATION DE BILLETS
============================================================ */

export function buildTicketPurchaseEmail(input: TicketPurchaseEmailData): RenderedEmail {
 const locale = normalizeLocale(input.locale), t = TRANSLATIONS[locale];
 validateEmail(input.recipientEmail); validateEmail(input.holderEmail);
 if (input.holderPhone) validatePhone(input.holderPhone);
 const title = requiredText(input.eventTitle, "EVENT_TITLE"), reference = requiredText(input.orderReference, "ORDER_REFERENCE", 120);
 if (!Array.isArray(input.tickets) || input.tickets.length < 1 || input.tickets.length > MAX_TICKETS) throw new EmailTemplateError("INVALID_TICKET_QUANTITY");
 const formattedDate = formatDateTime(input.eventStartsAt, input.eventTimeZone, locale);
 const date = formattedDate.date + " - " + formattedDate.time;
 const attachment = locale === "fr" ? "Vos billets PDF sont joints à cet email. Présentez le QR code à l'entrée." : "Your PDF tickets are attached. Present the QR code at the entrance.";
 const categories = [...new Set(input.tickets.map(ticket => requiredText(ticket.category || ticket.ticketNumber, "TICKET_CATEGORY")))].join(", ");
 const lines = [title, date, input.eventVenue || "", categories + " × " + input.tickets.length, reference, attachment].filter(Boolean);
 return { subject: t.ticketSubject + " - " + reference, text: lines.join("\n"), html: '<!doctype html><html><body style="margin:0;padding:16px;font-family:Arial,sans-serif;color:#142238"><div style="max-width:560px;margin:auto"><strong style="color:#07852d;font-size:22px">TIKEMIA</strong><h2 style="margin:12px 0;font-size:20px">' + escapeHtml(title) + '</h2><p style="margin:6px 0">' + escapeHtml(date) + '</p>' + (input.eventVenue ? '<p style="margin:6px 0">' + escapeHtml(input.eventVenue) + '</p>' : '') + '<p style="margin:6px 0">' + escapeHtml(categories) + ' × ' + input.tickets.length + '</p><p style="margin:12px 0;font-weight:bold">' + escapeHtml(attachment) + '</p><p style="font-size:12px;color:#64748b;margin:6px 0">' + escapeHtml(reference) + '</p></div></body></html>' };
}

/* ============================================================
   CONFIRMATION DE DON
============================================================ */

export function buildDonationConfirmationEmail(
  input: DonationConfirmationEmailData
): RenderedEmail {
  const locale =
    normalizeLocale(input.locale);

  const t =
    TRANSLATIONS[locale];

  validateEmail(
    input.recipientEmail
  );

  const campaignTitle =
    requiredText(
      input.campaignTitle,
      "CAMPAIGN_TITLE"
    );

  const donationReference =
    requiredText(
      input.donationReference,
      "DONATION_REFERENCE",
      120
    );

  const donorName =
    optionalText(
      input.donorName
    );

  const amount =
    formatAmount(
      input.amountMinor,
      input.currency,
      locale
    );

  const totalPaid =
    input.totalPaidMinor
      ? formatAmount(
          input.totalPaidMinor,
          input.currency,
          locale
        )
      : null;

  const date =
    formatConfirmationDate(
      input.confirmedAt,
      locale
    );

  const campaignUrl =
    safeHttpsUrl(
      input.campaignUrl
    );

  const rows: { label: string; value: string }[] = [
    {
      label: t.campaign,
      value: campaignTitle,
    },
    {
      label: t.donationAmount,
      value: amount,
    },
    {
      label: t.donationDate,
      value: date,
    },
    {
      label: t.reference,
      value: donationReference,
    },
  ];

  if (donorName) {
    rows.unshift({
      label: t.holder,
      value: donorName,
    });
  }

  if (totalPaid) {
    rows.push({
      label: t.totalPaid,
      value: totalPaid,
    });
  }

  const content = `
    <h1
      class="tikemia-heading"
      style="
        margin:0 0 18px;
        color:${COLORS.greenDark};
        font-size:27px;
        line-height:34px;
        font-weight:800;
      "
    >
      ${escapeHtml(t.donationTitle)}
    </h1>

    <p
      style="
        margin:0 0 12px;
        color:${COLORS.text};
        font-size:14px;
      "
    >
      ${escapeHtml(t.greeting)}
    </p>

    <p
      style="
        margin:0 0 25px;
        color:${COLORS.secondary};
        font-size:14px;
        line-height:23px;
      "
    >
      ${escapeHtml(t.donationIntro)}
    </p>

    <div
      class="tikemia-card"
      style="
        padding:22px;
        background:${COLORS.background};
        border:1px solid ${COLORS.border};
        border-radius:14px;
      "
    >
      ${detailsTable(rows)}
    </div>

    <div
      style="
        margin-top:23px;
        padding:21px;
        background:${COLORS.greenLight};
        border-radius:13px;
        text-align:center;
      "
    >
      <p
        style="
          margin:0 0 8px;
          color:${COLORS.greenDark};
          font-size:13px;
          font-weight:700;
        "
      >
        ${escapeHtml(t.donationAmount)}
      </p>

      <p
        style="
          margin:0;
          color:${COLORS.greenDark};
          font-size:29px;
          font-weight:800;
        "
      >
        ${escapeHtml(amount)}
      </p>
    </div>

    <p
      style="
        margin:24px 0 0;
        color:${COLORS.greenDark};
        font-size:15px;
        line-height:23px;
        font-weight:700;
        text-align:center;
      "
    >
      ${escapeHtml(t.donationThankYou)}
    </p>

    ${emailButton(
      t.viewCampaign,
      campaignUrl
    )}
  `;

  const text = [
    t.donationTitle,
    "",
    t.greeting,
    t.donationIntro,
    "",
    ...rows.map(
      (row) =>
        `${row.label}: ${row.value}`
    ),
    "",
    t.donationThankYou,
    "",
    ...(campaignUrl
      ? [
          t.viewCampaign,
          campaignUrl,
          "",
        ]
      : []),
    t.footer,
  ].join("\n");

  return {
    subject:
      `${t.donationSubject} — ${donationReference}`,

    html:
      emailLayout({
        locale,
        title:
          t.donationTitle,
        preheader:
          t.donationIntro,
        content,
        logoUrl:
          input.logoUrl,
      }),

    text,
  };
}

/* ============================================================
   ROUTAGE PAR NOM DE MODÈLE
============================================================ */

export type EmailTemplateInput =
  | {
      template: "ticket_purchase";
      data: TicketPurchaseEmailData;
    }
  | {
      template: "donation_confirmation";
      data: DonationConfirmationEmailData;
    };

export function renderTikemiaEmail(
  input: EmailTemplateInput
): RenderedEmail {
  switch (input.template) {
    case "ticket_purchase":
      return buildTicketPurchaseEmail(
        input.data
      );

    case "donation_confirmation":
      return buildDonationConfirmationEmail(
        input.data
      );

    default: {
      const exhaustive: never = input;

      throw new EmailTemplateError(
        `UNSUPPORTED_TEMPLATE:${String(exhaustive)}`
      );
    }
  }
}
