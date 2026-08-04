import "server-only";

import { createHash } from "node:crypto";

import {
  DeliveryChannel,
  DeliveryStatus,
  DeliveryType,
  OrderStatus,
  PaymentStatus,
  Prisma,
  TicketDocumentStatus,
  TicketDocumentType,
} from "@prisma/client";
import { Resend } from "resend";

import {
  PaymentError,
  PaymentValidationError,
} from "@/lib/payments/payment-errors";
import { prisma } from "@/lib/prisma";
import {
  generateOrderTicketPdfs,
  type GeneratedTicketPdf,
} from "@/lib/tickets/generate-ticket-pdf";

type DatabaseClient =
  | Prisma.TransactionClient
  | typeof prisma;

export type SendTicketEmailOptions = {
  orderId: string;
  transaction?: Prisma.TransactionClient;
  forceResend?: boolean;
  replyTo?: string | null;
  logoPath?: string;
  generatedAt?: Date;
};

export type SendTicketEmailResult = {
  orderId: string;
  orderReference: string;

  recipient: string;

  provider: "RESEND";
  providerMessageId: string;

  attachmentsCount: number;
  totalAttachmentsSize: number;

  deliveryLogIds: string[];

  sentAt: string;
};

type OrderEmailData = {
  id: string;
  reference: string;
  status: OrderStatus;
  currency: string;

  customerId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;

  payment: {
    status: PaymentStatus;
  } | null;

  event: {
    id: string;
    title: string;
    slug: string;

    venueName: string;
    address: string;
    city: string;
    country: string;

    startsAt: Date;
    endsAt: Date | null;
  };

  items: Array<{
    id: string;
    quantity: number;

    unitPrice: Prisma.Decimal;
    platformFee: Prisma.Decimal;
    total: Prisma.Decimal;

    ticketType: {
      id: string;
      name: string;
      description: string | null;
    };

    tickets: Array<{
      id: string;
      code: string;
    }>;
  }>;
};

type TicketDeliveryTarget = {
  ticketId: string;
  ticketCode: string;
};

const PROVIDER = "RESEND" as const;

const MAX_ATTACHMENTS_BYTES =
  38 * 1024 * 1024;

const MAX_EMAIL_RECIPIENT_LENGTH = 320;

let resendClient: Resend | null = null;
let resendClientApiKey: string | null = null;

function normalizeText(
  value: string | null | undefined,
): string {
  return (
    value
      ?.replace(/\s+/g, " ")
      .trim() ?? ""
  );
}

function normalizeIdentifier({
  value,
  field,
}: {
  value: string;
  field: string;
}): string {
  const normalized =
    normalizeText(value);

  if (!normalized) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_INVALID_REQUEST",

      message:
        `${field} est obligatoire.`,

      status: 400,

      details: {
        field,
      },
    });
  }

  return normalized;
}

function normalizeGeneratedAt(
  value: Date,
): Date {
  if (
    !(value instanceof Date) ||
    Number.isNaN(value.getTime())
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_INVALID_REQUEST",

      message:
        "La date de génération des billets est invalide.",

      status: 400,
    });
  }

  return value;
}

function normalizeEmail(
  value: string,
  fieldName: string,
): string {
  const normalized =
    normalizeText(value).toLowerCase();

  if (
    !normalized ||
    normalized.length >
      MAX_EMAIL_RECIPIENT_LENGTH ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      normalized,
    )
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_INVALID_REQUEST",

      message:
        `${fieldName} est invalide.`,

      status: 409,

      details: {
        fieldName,
      },
    });
  }

  return normalized;
}

function escapeHtml(
  value: string | null | undefined,
): string {
  return normalizeText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function decimalToFixed(
  value: Prisma.Decimal,
): string {
  return value
    .toDecimalPlaces(
      2,
      Prisma.Decimal.ROUND_HALF_UP,
    )
    .toFixed(2);
}

function divideAmount({
  amount,
  quantity,
  orderId,
  orderItemId,
}: {
  amount: Prisma.Decimal;
  quantity: number;
  orderId: string;
  orderItemId: string;
}): Prisma.Decimal {
  if (
    !Number.isInteger(quantity) ||
    quantity <= 0
  ) {
    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        "Une quantité de billets est invalide.",

      status: 500,

      retryable: false,

      exposeMessage: false,

      orderId,

      details: {
        orderItemId,
        quantity,
      },
    });
  }

  return amount
    .div(quantity)
    .toDecimalPlaces(
      2,
      Prisma.Decimal.ROUND_HALF_UP,
    );
}

function formatMoney({
  amount,
  currency,
}: {
  amount: string;
  currency: string;
}): string {
  const numericAmount =
    Number.parseFloat(amount);

  const normalizedCurrency =
    normalizeText(currency)
      .toUpperCase() || "XOF";

  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style: "currency",

        currency:
          normalizedCurrency,

        minimumFractionDigits:
          normalizedCurrency === "XOF"
            ? 0
            : 2,

        maximumFractionDigits:
          normalizedCurrency === "XOF"
            ? 0
            : 2,
      },
    ).format(
      Number.isFinite(numericAmount)
        ? numericAmount
        : 0,
    );
  } catch {
    return `${amount} ${normalizedCurrency}`;
  }
}

function formatDateTime(
  value: Date,
): string {
  if (
    !(value instanceof Date) ||
    Number.isNaN(value.getTime())
  ) {
    return "Date indisponible";
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(value);
}

function getApplicationUrl(): string {
  const value =
    normalizeText(
      process.env.NEXT_PUBLIC_APP_URL,
    ) ||
    normalizeText(
      process.env.APP_URL,
    );

  if (!value) {
    throw new PaymentError({
      code:
        "PAYMENT_CONFIGURATION_ERROR",

      message:
        "L’URL publique de Tikemia est absente.",

      status: 500,

      retryable: false,

      exposeMessage: false,
    });
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new PaymentError({
      code:
        "PAYMENT_CONFIGURATION_ERROR",

      message:
        "L’URL publique de Tikemia est invalide.",

      status: 500,

      retryable: false,

      exposeMessage: false,
    });
  }

  if (
    process.env.NODE_ENV ===
      "production" &&
    url.protocol !== "https:"
  ) {
    throw new PaymentError({
      code:
        "PAYMENT_CONFIGURATION_ERROR",

      message:
        "L’URL publique de Tikemia doit utiliser HTTPS en production.",

      status: 500,

      retryable: false,

      exposeMessage: false,
    });
  }

  return url
    .toString()
    .replace(/\/$/, "");
}

function getEmailConfiguration(): {
  apiKey: string;
  from: string;
  replyTo: string | null;
} {
  const apiKey =
    normalizeText(
      process.env.RESEND_API_KEY,
    );

  const from =
    normalizeText(
      process.env.MAIL_FROM_TICKETS,
    ) ||
    normalizeText(
      process.env.MAIL_FROM,
    );

  const replyTo =
    normalizeText(
      process.env.MAIL_REPLY_TO_SUPPORT,
    ) || null;

  if (!apiKey || !from) {
    throw new PaymentError({
      code:
        "PAYMENT_CONFIGURATION_ERROR",

      message:
        "La configuration d’envoi des billets est incomplète.",

      status: 500,

      retryable: false,

      exposeMessage: false,
    });
  }

  return {
    apiKey,
    from,
    replyTo,
  };
}

function getResendClient(
  apiKey: string,
): Resend {
  if (
    resendClient &&
    resendClientApiKey === apiKey
  ) {
    return resendClient;
  }

  resendClient =
    new Resend(apiKey);

  resendClientApiKey =
    apiKey;

  return resendClient;
}

function getEmailIdempotencyKey({
  orderId,
  recipient,
}: {
  orderId: string;
  recipient: string;
}): string {
  return createHash("sha256")
    .update(
      `tikemia:ticket-email:${orderId}:${recipient.toLowerCase()}`,
      "utf8",
    )
    .digest("hex");
}

async function getOrderEmailData({
  database,
  orderId,
}: {
  database: DatabaseClient;
  orderId: string;
}): Promise<OrderEmailData> {
  const order =
    await database.order.findUnique({
      where: {
        id: orderId,
      },

      select: {
        id: true,
        reference: true,
        status: true,
        currency: true,

        customerId: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,

        payment: {
          select: {
            status: true,
          },
        },

        event: {
          select: {
            id: true,
            title: true,
            slug: true,
            venueName: true,
            address: true,
            city: true,
            country: true,
            startsAt: true,
            endsAt: true,
          },
        },

        items: {
          orderBy: {
            id: "asc",
          },

          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            platformFee: true,
            total: true,

            ticketType: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },

            tickets: {
              orderBy: {
                createdAt: "asc",
              },

              select: {
                id: true,
                code: true,
              },
            },
          },
        },
      },
    });

  if (!order) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_ORDER_NOT_FOUND",

      message:
        "La commande est introuvable.",

      status: 404,

      orderId,
    });
  }

  if (
    order.status !==
      OrderStatus.PAID ||
    order.payment?.status !==
      PaymentStatus.SUCCESS
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_ORDER_NOT_PAYABLE",

      message:
        "Les billets ne peuvent être envoyés qu’après confirmation du paiement.",

      status: 409,

      orderId:
        order.id,
    });
  }

  if (order.items.length === 0) {
    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        "La commande ne contient aucun billet.",

      status: 500,

      retryable: false,

      exposeMessage: false,

      orderId:
        order.id,
    });
  }

  const expectedTickets =
    order.items.reduce(
      (total, item) => {
        if (
          !Number.isInteger(
            item.quantity,
          ) ||
          item.quantity <= 0
        ) {
          throw new PaymentError({
            code:
              "PAYMENT_TICKET_ISSUANCE_FAILED",

            message:
              "Une quantité de billets de la commande est invalide.",

            status: 500,

            retryable: false,

            exposeMessage: false,

            orderId:
              order.id,

            details: {
              orderItemId:
                item.id,

              quantity:
                item.quantity,
            },
          });
        }

        if (
          item.tickets.length >
          item.quantity
        ) {
          throw new PaymentError({
            code:
              "PAYMENT_TICKET_ISSUANCE_FAILED",

            message:
              "Le nombre de billets dépasse la quantité commandée.",

            status: 500,

            retryable: false,

            exposeMessage: false,

            orderId:
              order.id,

            details: {
              orderItemId:
                item.id,

              expected:
                item.quantity,

              available:
                item.tickets.length,
            },
          });
        }

        return (
          total +
          item.quantity
        );
      },
      0,
    );

  const availableTickets =
    order.items.reduce(
      (total, item) =>
        total +
        item.tickets.length,
      0,
    );

  if (
    expectedTickets <= 0 ||
    availableTickets !==
      expectedTickets
  ) {
    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        "Tous les billets de la commande ne sont pas encore disponibles.",

      status: 409,

      retryable: true,

      exposeMessage: false,

      orderId:
        order.id,

      details: {
        expectedTickets,
        availableTickets,
      },
    });
  }

  normalizeEmail(
    order.customerEmail,
    "L’adresse e-mail du client",
  );

  return order;
}

function buildTicketRows({
  order,
}: {
  order: OrderEmailData;
}): string {
  return order.items
    .map((item) => {
      const feePerTicket =
        divideAmount({
          amount:
            item.platformFee,

          quantity:
            item.quantity,

          orderId:
            order.id,

          orderItemId:
            item.id,
        });

      const totalPerTicket =
        divideAmount({
          amount:
            item.total,

          quantity:
            item.quantity,

          orderId:
            order.id,

          orderItemId:
            item.id,
        });

      const ticketCodes =
        item.tickets
          .map(
            (ticket) =>
              escapeHtml(
                ticket.code,
              ),
          )
          .join("<br />");

      return `
        <tr>
          <td style="padding:14px;border-bottom:1px solid #e8ecef;vertical-align:top;">
            <div style="font-weight:800;color:#101416;">
              ${escapeHtml(
                item.ticketType.name,
              )}
            </div>

            ${
              item.ticketType.description
                ? `
                  <div style="margin-top:4px;font-size:12px;line-height:18px;color:#6b7378;">
                    ${escapeHtml(
                      item.ticketType.description,
                    )}
                  </div>
                `
                : ""
            }
          </td>

          <td style="padding:14px;border-bottom:1px solid #e8ecef;text-align:center;vertical-align:top;font-weight:800;color:#101416;">
            ${item.quantity}
          </td>

          <td style="padding:14px;border-bottom:1px solid #e8ecef;text-align:right;vertical-align:top;font-weight:700;color:#101416;">
            ${escapeHtml(
              formatMoney({
                amount:
                  decimalToFixed(
                    item.unitPrice,
                  ),

                currency:
                  order.currency,
              }),
            )}
          </td>

          <td style="padding:14px;border-bottom:1px solid #e8ecef;text-align:right;vertical-align:top;font-weight:700;color:#101416;">
            ${escapeHtml(
              formatMoney({
                amount:
                  decimalToFixed(
                    feePerTicket,
                  ),

                currency:
                  order.currency,
              }),
            )}
          </td>

          <td style="padding:14px;border-bottom:1px solid #e8ecef;text-align:right;vertical-align:top;font-weight:900;color:#17894b;">
            ${escapeHtml(
              formatMoney({
                amount:
                  decimalToFixed(
                    totalPerTicket,
                  ),

                currency:
                  order.currency,
              }),
            )}
          </td>

          <td style="padding:14px;border-bottom:1px solid #e8ecef;vertical-align:top;font-family:monospace;font-size:11px;line-height:17px;color:#4f575c;">
            ${ticketCodes}
          </td>
        </tr>
      `;
    })
    .join("");
}

function buildEmailHtml({
  order,
}: {
  order: OrderEmailData;
}): string {
  const appUrl =
    getApplicationUrl();

  const eventUrl =
    `${appUrl}/events/${encodeURIComponent(
      order.event.slug,
    )}`;

  const ticketsUrl =
    `${appUrl}/account/tickets`;

  const ordersUrl =
    `${appUrl}/account/orders`;

  const totalTickets =
    order.items.reduce(
      (total, item) =>
        total +
        item.quantity,
      0,
    );

  const orderTotal =
    order.items.reduce(
      (total, item) =>
        total.plus(item.total),

      new Prisma.Decimal(0),
    );

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <meta name="color-scheme" content="light" />
    <title>Vos billets Tikemia</title>
  </head>

  <body style="margin:0;padding:0;background:#f3f5f6;font-family:Arial,Helvetica,sans-serif;color:#101416;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      Vos ${totalTickets} billet${totalTickets > 1 ? "s" : ""} pour ${escapeHtml(
        order.event.title,
      )}.
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f3f5f6;">
      <tr>
        <td align="center" style="padding:28px 12px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:760px;background:#ffffff;border-radius:22px;overflow:hidden;box-shadow:0 16px 50px rgba(0,0,0,.08);">
            <tr>
              <td style="height:8px;background:#16a766;"></td>
            </tr>

            <tr>
              <td style="padding:28px 30px 18px;background:#071015;">
                <div style="font-size:24px;font-weight:900;letter-spacing:.5px;color:#a3e635;">
                  TIKEMIA
                </div>

                <div style="margin-top:24px;font-size:13px;font-weight:800;letter-spacing:1.6px;color:#8c969b;">
                  PAIEMENT CONFIRMÉ
                </div>

                <h1 style="margin:8px 0 0;font-size:30px;line-height:38px;color:#ffffff;">
                  Vos billets sont prêts
                </h1>

                <p style="margin:12px 0 0;font-size:15px;line-height:24px;color:#b6bec2;">
                  Bonjour ${escapeHtml(
                    order.customerName,
                  )}, votre commande
                  <strong style="color:#ffffff;">
                    ${escapeHtml(
                      order.reference,
                    )}
                  </strong>
                  a été confirmée.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:28px 30px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f7f9f9;border:1px solid #e8ecef;border-radius:16px;">
                  <tr>
                    <td style="padding:18px 20px;">
                      <div style="font-size:12px;font-weight:800;letter-spacing:1.2px;color:#17894b;">
                        ÉVÉNEMENT
                      </div>

                      <div style="margin-top:7px;font-size:23px;font-weight:900;line-height:30px;color:#101416;">
                        ${escapeHtml(
                          order.event.title,
                        )}
                      </div>

                      <div style="margin-top:12px;font-size:14px;line-height:22px;color:#596166;">
                        ${escapeHtml(
                          formatDateTime(
                            order.event.startsAt,
                          ),
                        )}
                        <br />
                        ${escapeHtml(
                          [
                            order.event.venueName,
                            order.event.city,
                            order.event.country,
                          ]
                            .filter(Boolean)
                            .join(", "),
                        )}
                      </div>
                    </td>
                  </tr>
                </table>

                <h2 style="margin:28px 0 12px;font-size:18px;color:#101416;">
                  Détail des billets
                </h2>

                <div style="overflow-x:auto;border:1px solid #e8ecef;border-radius:16px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;min-width:680px;">
                    <thead>
                      <tr style="background:#071015;">
                        <th align="left" style="padding:12px 14px;font-size:11px;color:#ffffff;">Catégorie</th>
                        <th align="center" style="padding:12px 14px;font-size:11px;color:#ffffff;">Qté</th>
                        <th align="right" style="padding:12px 14px;font-size:11px;color:#ffffff;">Prix</th>
                        <th align="right" style="padding:12px 14px;font-size:11px;color:#ffffff;">Frais</th>
                        <th align="right" style="padding:12px 14px;font-size:11px;color:#ffffff;">Total / billet</th>
                        <th align="left" style="padding:12px 14px;font-size:11px;color:#ffffff;">Codes</th>
                      </tr>
                    </thead>

                    <tbody>
                      ${buildTicketRows({
                        order,
                      })}
                    </tbody>
                  </table>
                </div>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:18px;">
                  <tr>
                    <td style="font-size:14px;color:#6b7378;">
                      ${totalTickets} billet${totalTickets > 1 ? "s" : ""}
                    </td>

                    <td align="right" style="font-size:22px;font-weight:900;color:#17894b;">
                      ${escapeHtml(
                        formatMoney({
                          amount:
                            decimalToFixed(
                              orderTotal,
                            ),

                          currency:
                            order.currency,
                        }),
                      )}
                    </td>
                  </tr>
                </table>

                <div style="margin-top:26px;padding:18px 20px;border-radius:16px;background:#fff8e8;border:1px solid #f4dfad;">
                  <div style="font-size:14px;font-weight:800;color:#7c5c12;">
                    Billets joints à cet e-mail
                  </div>

                  <div style="margin-top:6px;font-size:13px;line-height:21px;color:#7a6b48;">
                    Chaque PDF contient un QR code unique et signé.
                    Présentez le PDF ou le QR code à l’entrée de l’événement.
                  </div>
                </div>

                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:26px;">
                  <tr>
                    <td>
                      <a
                        href="${escapeHtml(
                          ticketsUrl,
                        )}"
                        style="display:inline-block;padding:13px 20px;border-radius:12px;background:#a3e635;color:#071015;text-decoration:none;font-size:14px;font-weight:900;"
                      >
                        Voir mes billets
                      </a>
                    </td>

                    <td style="padding-left:10px;">
                      <a
                        href="${escapeHtml(
                          ordersUrl,
                        )}"
                        style="display:inline-block;padding:13px 20px;border-radius:12px;background:#071015;color:#ffffff;text-decoration:none;font-size:14px;font-weight:800;"
                      >
                        Voir ma commande
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:26px 0 0;font-size:12px;line-height:20px;color:#7b8489;">
                  Pour consulter la page de l’événement :
                  <a
                    href="${escapeHtml(
                      eventUrl,
                    )}"
                    style="color:#17894b;font-weight:700;text-decoration:none;"
                  >
                    ouvrir l’événement
                  </a>
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:18px 30px;background:#071015;font-size:11px;line-height:18px;color:#8f999e;">
                Cet e-mail a été envoyé automatiquement par Tikemia.
                Ne partagez pas vos billets ni leurs QR codes avant le contrôle d’accès.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildEmailText({
  order,
}: {
  order: OrderEmailData;
}): string {
  const lines = [
    "TIKEMIA",
    "",
    `Bonjour ${order.customerName},`,
    "",
    `Votre paiement pour la commande ${order.reference} est confirmé.`,
    "",
    `Événement : ${order.event.title}`,
    `Date : ${formatDateTime(
      order.event.startsAt,
    )}`,
    `Lieu : ${[
      order.event.venueName,
      order.event.city,
      order.event.country,
    ]
      .filter(Boolean)
      .join(", ")}`,
    "",
    "Billets :",
  ];

  for (const item of order.items) {
    const feePerTicket =
      divideAmount({
        amount:
          item.platformFee,

        quantity:
          item.quantity,

        orderId:
          order.id,

        orderItemId:
          item.id,
      });

    const totalPerTicket =
      divideAmount({
        amount:
          item.total,

        quantity:
          item.quantity,

        orderId:
          order.id,

        orderItemId:
          item.id,
      });

    lines.push(
      `- ${item.ticketType.name} : ${item.quantity} × ${formatMoney({
        amount:
          decimalToFixed(
            item.unitPrice,
          ),

        currency:
          order.currency,
      })} | Frais : ${formatMoney({
        amount:
          decimalToFixed(
            feePerTicket,
          ),

        currency:
          order.currency,
      })} | Total par billet : ${formatMoney({
        amount:
          decimalToFixed(
            totalPerTicket,
          ),

        currency:
          order.currency,
      })}`,
    );

    for (const ticket of item.tickets) {
      lines.push(
        `  Code : ${ticket.code}`,
      );
    }
  }

  lines.push(
    "",
    "Les billets PDF contenant les QR codes sont joints à cet e-mail.",
    "Ne partagez pas vos billets ni leurs QR codes avant le contrôle d’accès.",
  );

  return lines.join("\n");
}

function buildAttachments(
  generatedPdfs: GeneratedTicketPdf[],
): Array<{
  filename: string;
  content: Buffer;
}> {
  if (
    generatedPdfs.length === 0
  ) {
    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        "Aucun billet PDF n’a été généré.",

      status: 500,

      retryable: true,

      exposeMessage: false,
    });
  }

  const totalSize =
    generatedPdfs.reduce(
      (total, pdf) => {
        if (
          !pdf.buffer ||
          pdf.fileSize <= 0 ||
          pdf.buffer.byteLength !==
            pdf.fileSize
        ) {
          throw new PaymentError({
            code:
              "PAYMENT_TICKET_ISSUANCE_FAILED",

            message:
              "Un fichier PDF de billet est invalide.",

            status: 500,

            retryable: true,

            exposeMessage: false,

            details: {
              ticketId:
                pdf.ticketId,

              fileSize:
                pdf.fileSize,

              bufferSize:
                pdf.buffer?.byteLength ??
                0,
            },
          });
        }

        return (
          total +
          pdf.fileSize
        );
      },
      0,
    );

  if (
    totalSize >
    MAX_ATTACHMENTS_BYTES
  ) {
    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        "La taille totale des billets dépasse la limite d’envoi par e-mail.",

      status: 413,

      retryable: false,

      exposeMessage: false,

      details: {
        totalSize,

        limit:
          MAX_ATTACHMENTS_BYTES,
      },
    });
  }

  return generatedPdfs.map(
    (pdf) => ({
      filename:
        pdf.fileName,

      content:
        pdf.buffer,
    }),
  );
}

function getTicketDeliveryTargets(
  order: OrderEmailData,
): TicketDeliveryTarget[] {
  return order.items.flatMap(
    (item) =>
      item.tickets.map(
        (ticket) => ({
          ticketId:
            ticket.id,

          ticketCode:
            ticket.code,
        }),
      ),
  );
}

async function findExistingSuccessfulDelivery({
  database,
  orderId,
  recipient,
}: {
  database: DatabaseClient;
  orderId: string;
  recipient: string;
}) {
  return database.deliveryLog.findFirst({
    where: {
      orderId,

      channel:
        DeliveryChannel.EMAIL,

      type:
        DeliveryType.TICKET_PDF,

      status:
        DeliveryStatus.SENT,

      recipient: {
        equals:
          recipient,

        mode:
          "insensitive",
      },

      providerMessageId: {
        not: null,
      },
    },

    orderBy: {
      sentAt: "desc",
    },

    select: {
      id: true,
      providerMessageId: true,
      sentAt: true,
    },
  });
}

async function ensurePendingDeliveryLogs({
  database,
  order,
  recipient,
}: {
  database: DatabaseClient;
  order: OrderEmailData;
  recipient: string;
}): Promise<string[]> {
  const targets =
    getTicketDeliveryTargets(order);

  const existingLogs =
    await database.deliveryLog.findMany({
      where: {
        orderId:
          order.id,

        channel:
          DeliveryChannel.EMAIL,

        type:
          DeliveryType.TICKET_PDF,

        recipient: {
          equals:
            recipient,

          mode:
            "insensitive",
        },

        ticketId: {
          in:
            targets.map(
              (target) =>
                target.ticketId,
            ),
        },
      },

      select: {
        id: true,
        ticketId: true,
      },
    });

  const existingByTicketId =
    new Map(
      existingLogs.map(
        (log) => [
          log.ticketId,
          log.id,
        ]),
    );

  const deliveryLogIds: string[] = [];

  for (const target of targets) {
    const existingId =
      existingByTicketId.get(
        target.ticketId,
      );

    if (existingId) {
      deliveryLogIds.push(
        existingId,
      );

      continue;
    }

    const created =
      await database.deliveryLog.create({
        data: {
          userId:
            order.customerId,

          orderId:
            order.id,

          ticketId:
            target.ticketId,

          channel:
            DeliveryChannel.EMAIL,

          type:
            DeliveryType.TICKET_PDF,

          status:
            DeliveryStatus.PENDING,

          recipient,

          subject:
            `Votre billet ${target.ticketCode}`,

          scheduledAt:
            new Date(),

          metadata: {
            orderReference:
              order.reference,

            ticketCode:
              target.ticketCode,

            eventTitle:
              order.event.title,
          },
        },

        select: {
          id: true,
        },
      });

    deliveryLogIds.push(
      created.id,
    );
  }

  return deliveryLogIds;
}

async function markDeliveriesProcessing({
  database,
  deliveryLogIds,
  attemptedAt,
}: {
  database: DatabaseClient;
  deliveryLogIds: string[];
  attemptedAt: Date;
}): Promise<void> {
  if (
    deliveryLogIds.length === 0
  ) {
    return;
  }

  await database.deliveryLog.updateMany({
    where: {
      id: {
        in: deliveryLogIds,
      },

      status: {
        in: [
          DeliveryStatus.PENDING,
          DeliveryStatus.FAILED,
          DeliveryStatus.PROCESSING,
        ],
      },
    },

    data: {
      status:
        DeliveryStatus.PROCESSING,

      provider:
        PROVIDER,

      failedAt:
        null,

      errorCode:
        null,

      errorMessage:
        null,

      lastAttemptAt:
        attemptedAt,

      attempts: {
        increment: 1,
      },
    },
  });
}

async function markDeliveriesFailed({
  database,
  deliveryLogIds,
  failedAt,
  errorCode,
  errorMessage,
}: {
  database: DatabaseClient;
  deliveryLogIds: string[];
  failedAt: Date;
  errorCode: string;
  errorMessage: string;
}): Promise<void> {
  if (
    deliveryLogIds.length === 0
  ) {
    return;
  }

  await database.deliveryLog
    .updateMany({
      where: {
        id: {
          in:
            deliveryLogIds,
        },
      },

      data: {
        status:
          DeliveryStatus.FAILED,

        provider:
          PROVIDER,

        failedAt,

        errorCode:
          errorCode.slice(
            0,
            255,
          ),

        errorMessage:
          errorMessage.slice(
            0,
            2_000,
          ),
      },
    })
    .catch((persistenceError) => {
      console.error(
        "[TICKET_EMAIL_DELIVERY_FAILURE_LOG_ERROR]",
        {
          deliveryLogIds,

          error:
            persistenceError instanceof Error
              ? {
                  name:
                    persistenceError.name,

                  message:
                    persistenceError.message,
                }
              : String(
                  persistenceError,
                ),
        },
      );
    });
}

async function markDeliveriesSent({
  database,
  deliveryLogIds,
  providerMessageId,
  sentAt,
}: {
  database: DatabaseClient;
  deliveryLogIds: string[];
  providerMessageId: string;
  sentAt: Date;
}): Promise<void> {
  if (
    deliveryLogIds.length === 0
  ) {
    return;
  }

  await database.deliveryLog.updateMany({
    where: {
      id: {
        in: deliveryLogIds,
      },
    },

    data: {
      status:
        DeliveryStatus.SENT,

      provider:
        PROVIDER,

      providerMessageId,

      sentAt,

      deliveredAt:
        null,

      failedAt:
        null,

      errorCode:
        null,

      errorMessage:
        null,
    },
  });
}

async function saveTicketPdfDocuments({
  database,
  generatedPdfs,
  generatedAt,
}: {
  database: DatabaseClient;
  generatedPdfs: GeneratedTicketPdf[];
  generatedAt: Date;
}): Promise<void> {
  for (const pdf of generatedPdfs) {
    await database.ticketDocument.upsert({
      where: {
        ticketId_type: {
          ticketId:
            pdf.ticketId,

          type:
            TicketDocumentType.PDF,
        },
      },

      create: {
        ticketId:
          pdf.ticketId,

        type:
          TicketDocumentType.PDF,

        status:
          TicketDocumentStatus.READY,

        generationKey:
          `ticket:${pdf.ticketId}:pdf:v1`,

        fileName:
          pdf.fileName,

        mimeType:
          pdf.mimeType,

        fileSize:
          pdf.fileSize,

        checksum:
          pdf.checksum,

        generatedAt,

        metadata:
          pdf.metadata,
      },

      update: {
        status:
          TicketDocumentStatus.READY,

        generationKey:
          `ticket:${pdf.ticketId}:pdf:v1`,

        fileName:
          pdf.fileName,

        mimeType:
          pdf.mimeType,

        fileSize:
          pdf.fileSize,

        checksum:
          pdf.checksum,

        generatedAt,

        failureReason:
          null,

        metadata:
          pdf.metadata,
      },
    });
  }
}

export async function sendTicketEmail({
  orderId: rawOrderId,
  transaction,
  forceResend = false,
  replyTo,
  logoPath,
  generatedAt = new Date(),
}: SendTicketEmailOptions): Promise<
  SendTicketEmailResult
> {
  const orderId =
    normalizeIdentifier({
      value:
        rawOrderId,

      field:
        "orderId",
    });

  const validGeneratedAt =
    normalizeGeneratedAt(
      generatedAt,
    );

  const database: DatabaseClient =
    transaction ?? prisma;

  const order =
    await getOrderEmailData({
      database,
      orderId,
    });

  const recipient =
    normalizeEmail(
      order.customerEmail,
      "L’adresse e-mail du client",
    );

  const existingDelivery =
    await findExistingSuccessfulDelivery({
      database,

      orderId:
        order.id,

      recipient,
    });

  if (
    existingDelivery &&
    !forceResend &&
    existingDelivery.providerMessageId
  ) {
    return {
      orderId:
        order.id,

      orderReference:
        order.reference,

      recipient,

      provider:
        PROVIDER,

      providerMessageId:
        existingDelivery.providerMessageId,

      attachmentsCount:
        getTicketDeliveryTargets(
          order,
        ).length,

      totalAttachmentsSize:
        0,

      deliveryLogIds: [
        existingDelivery.id,
      ],

      sentAt:
        (
          existingDelivery.sentAt ??
          validGeneratedAt
        ).toISOString(),
    };
  }

  const generatedPdfs =
    await generateOrderTicketPdfs({
      orderId:
        order.id,

      transaction,

      logoPath,

      generatedAt:
        validGeneratedAt,
    });

  const attachments =
    buildAttachments(
      generatedPdfs.tickets,
    );

  const totalAttachmentsSize =
    generatedPdfs.tickets.reduce(
      (total, pdf) =>
        total +
        pdf.fileSize,
      0,
    );

  const deliveryLogIds =
    await ensurePendingDeliveryLogs({
      database,
      order,
      recipient,
    });

  const attemptedAt =
    new Date();

  await markDeliveriesProcessing({
    database,
    deliveryLogIds,
    attemptedAt,
  });

  const configuration =
    getEmailConfiguration();

  const resend =
    getResendClient(
      configuration.apiKey,
    );

  const idempotencyKey =
    getEmailIdempotencyKey({
      orderId:
        order.id,

      recipient,
    });

  let response:
    Awaited<
      ReturnType<
        typeof resend.emails.send
      >
    >;

  try {
    response =
      await resend.emails.send(
        {
          from:
            configuration.from,

          to: [
            recipient,
          ],

          subject:
            `Vos billets Tikemia — ${order.event.title}`,

          html:
            buildEmailHtml({
              order,
            }),

          text:
            buildEmailText({
              order,
            }),

          attachments,

          replyTo:
            normalizeText(replyTo) ||
            configuration.replyTo ||
            undefined,

          headers: {
            "X-Tikemia-Order-Id":
              order.id,

            "X-Tikemia-Order-Reference":
              order.reference,
          },

          tags: [
            {
              name:
                "category",

              value:
                "ticket-delivery",
            },

            {
              name:
                "order_reference",

              value:
                order.reference
                  .replace(
                    /[^a-zA-Z0-9_-]/g,
                    "_",
                  )
                  .slice(
                    0,
                    256,
                  ),
            },
          ],
        },

        {
          idempotencyKey,
        },
      );
  } catch (error) {
    await markDeliveriesFailed({
      database,
      deliveryLogIds,

      failedAt:
        new Date(),

      errorCode:
        "RESEND_REQUEST_FAILED",

      errorMessage:
        error instanceof Error
          ? error.message
          : "Impossible de contacter le service d’envoi.",
    });

    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        "Impossible d’envoyer les billets par e-mail.",

      status: 502,

      retryable: true,

      exposeMessage: false,

      orderId:
        order.id,

      cause:
        error,

      details: {
        provider:
          PROVIDER,
      },
    });
  }

  if (
    response.error ||
    !response.data?.id
  ) {
    const providerMessage =
      response.error?.message ||
      "Le fournisseur n’a retourné aucun identifiant de message.";

    await markDeliveriesFailed({
      database,
      deliveryLogIds,

      failedAt:
        new Date(),

      errorCode:
        response.error?.name ||
        "RESEND_SEND_FAILED",

      errorMessage:
        providerMessage,
    });

    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        "Impossible d’envoyer les billets par e-mail.",

      status: 502,

      retryable: true,

      exposeMessage: false,

      orderId:
        order.id,

      details: {
        provider:
          PROVIDER,

        providerError:
          response.error
            ? {
                name:
                  response.error.name,

                message:
                  response.error.message,
              }
            : null,
      },
    });
  }

  const sentAt =
    new Date();

  await markDeliveriesSent({
    database,
    deliveryLogIds,

    providerMessageId:
      response.data.id,

    sentAt,
  });

  try {
    await saveTicketPdfDocuments({
      database,

      generatedPdfs:
        generatedPdfs.tickets,

      generatedAt:
        validGeneratedAt,
    });
  } catch (error) {
    /*
     * L’e-mail est déjà parti.
     * On journalise seulement l’échec d’enregistrement du document
     * pour éviter un second envoi automatique au client.
     */
    console.error(
      "[TICKET_PDF_DOCUMENT_PERSIST_ERROR]",
      {
        orderId:
          order.id,

        providerMessageId:
          response.data.id,

        error:
          error instanceof Error
            ? {
                name:
                  error.name,

                message:
                  error.message,
              }
            : String(error),
      },
    );
  }

  return {
    orderId:
      order.id,

    orderReference:
      order.reference,

    recipient,

    provider:
      PROVIDER,

    providerMessageId:
      response.data.id,

    attachmentsCount:
      attachments.length,

    totalAttachmentsSize,

    deliveryLogIds,

    sentAt:
      sentAt.toISOString(),
  };
}