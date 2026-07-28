import "server-only";

import {
  createHash,
} from "node:crypto";

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
import {
  Resend,
} from "resend";

import {
  PaymentError,
  PaymentValidationError,
} from "@/lib/payments/payment-errors";
import {
  generateOrderTicketPdfs,
  type GeneratedTicketPdf,
} from "@/lib/tickets/generate-ticket-pdf";
import { prisma } from "@/lib/prisma";

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

  customerName: string;
  customerEmail: string;
  customerPhone: string;

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

const PROVIDER =
  "RESEND";

const MAX_ATTACHMENTS_BYTES =
  38 * 1024 * 1024;

let resendClient:
  | Resend
  | null =
  null;

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string {
  return value
    ?.replace(
      /\s+/g,
      " ",
    )
    .trim() ?? "";
}

function normalizeIdentifier({
  value,
  field,
}: {
  value: string;
  field: string;
}): string {
  const normalized =
    normalizeText(
      value,
    );

  if (!normalized) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_INVALID_REQUEST",

      message:
        `${field} est obligatoire.`,

      status:
        400,

      details: {
        field,
      },
    });
  }

  return normalized;
}

function escapeHtml(
  value:
    | string
    | null
    | undefined,
): string {
  return normalizeText(
    value,
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

function decimalToFixed(
  value: Prisma.Decimal,
): string {
  return value
    .toDecimalPlaces(
      2,
      Prisma.Decimal
        .ROUND_HALF_UP,
    )
    .toFixed(
      2,
    );
}

function divideAmount({
  amount,
  quantity,
}: {
  amount: Prisma.Decimal;
  quantity: number;
}): Prisma.Decimal {
  if (
    !Number.isInteger(
      quantity,
    ) ||
    quantity <=
      0
  ) {
    return new Prisma.Decimal(
      0,
    );
  }

  return amount
    .div(
      quantity,
    )
    .toDecimalPlaces(
      2,
      Prisma.Decimal
        .ROUND_HALF_UP,
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
    Number.parseFloat(
      amount,
    );

  const normalizedCurrency =
    normalizeText(
      currency,
    ).toUpperCase() ||
    "XOF";

  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style:
          "currency",

        currency:
          normalizedCurrency,

        maximumFractionDigits:
          normalizedCurrency ===
          "XOF"
            ? 0
            : 2,
      },
    ).format(
      Number.isFinite(
        numericAmount,
      )
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
    },
  ).format(
    value,
  );
}

function getApplicationUrl(): string {
  const value =
    normalizeText(
      process.env
        .NEXT_PUBLIC_APP_URL,
    ) ||
    normalizeText(
      process.env
        .APP_URL,
    );

  if (!value) {
    throw new PaymentError({
      code:
        "PAYMENT_CONFIGURATION_ERROR",

      message:
        "L’URL publique de Tikemia est absente.",

      status:
        500,

      retryable:
        false,

      exposeMessage:
        false,
    });
  }

  try {
    return new URL(
      value,
    )
      .toString()
      .replace(
        /\/$/,
        "",
      );
  } catch {
    throw new PaymentError({
      code:
        "PAYMENT_CONFIGURATION_ERROR",

      message:
        "L’URL publique de Tikemia est invalide.",

      status:
        500,

      retryable:
        false,

      exposeMessage:
        false,
    });
  }
}

function getEmailConfiguration(): {
  apiKey: string;
  from: string;
  replyTo: string | null;
} {
  const apiKey =
    normalizeText(
      process.env
        .RESEND_API_KEY,
    );

  const from =
    normalizeText(
      process.env
        .MAIL_FROM_TICKETS,
    ) ||
    normalizeText(
      process.env
        .MAIL_FROM,
    );

  const replyTo =
    normalizeText(
      process.env
        .MAIL_REPLY_TO_SUPPORT,
    ) ||
    null;

  if (
    !apiKey ||
    !from
  ) {
    throw new PaymentError({
      code:
        "PAYMENT_CONFIGURATION_ERROR",

      message:
        "La configuration d’envoi des billets est incomplète.",

      status:
        500,

      retryable:
        false,

      exposeMessage:
        false,
    });
  }

  return {
    apiKey,
    from,
    replyTo,
  };
}

function getResendClient(): Resend {
  if (
    resendClient
  ) {
    return resendClient;
  }

  const {
    apiKey,
  } =
    getEmailConfiguration();

  resendClient =
    new Resend(
      apiKey,
    );

  return resendClient;
}

function getEmailIdempotencyKey({
  orderId,
  recipient,
}: {
  orderId: string;
  recipient: string;
}): string {
  return createHash(
    "sha256",
  )
    .update(
      `tikemia:ticket-email:${orderId}:${recipient.toLowerCase()}`,
      "utf8",
    )
    .digest(
      "hex",
    );
}

async function getOrderEmailData({
  database,
  orderId,
}: {
  database: DatabaseClient;
  orderId: string;
}): Promise<OrderEmailData> {
  const order =
    await database
      .order
      .findUnique({
        where: {
          id:
            orderId,
        },

        select: {
          id:
            true,

          reference:
            true,

          status:
            true,

          currency:
            true,

          customerName:
            true,

          customerEmail:
            true,

          customerPhone:
            true,

          payment: {
            select: {
              status:
                true,
            },
          },

          event: {
            select: {
              id:
                true,

              title:
                true,

              slug:
                true,

              venueName:
                true,

              address:
                true,

              city:
                true,

              country:
                true,

              startsAt:
                true,

              endsAt:
                true,
            },
          },

          items: {
            orderBy: {
              id:
                "asc",
            },

            select: {
              id:
                true,

              quantity:
                true,

              unitPrice:
                true,

              platformFee:
                true,

              total:
                true,

              ticketType: {
                select: {
                  id:
                    true,

                  name:
                    true,

                  description:
                    true,
                },
              },

              tickets: {
                orderBy: {
                  createdAt:
                    "asc",
                },

                select: {
                  id:
                    true,

                  code:
                    true,
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

      status:
        404,

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

      status:
        409,

      orderId:
        order.id,
    });
  }

  const expectedTickets =
    order.items.reduce(
      (
        total,
        item,
      ) =>
        total +
        item.quantity,
      0,
    );

  const availableTickets =
    order.items.reduce(
      (
        total,
        item,
      ) =>
        total +
        item.tickets.length,
      0,
    );

  if (
    expectedTickets <=
      0 ||
    availableTickets !==
      expectedTickets
  ) {
    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        "Tous les billets de la commande ne sont pas encore disponibles.",

      status:
        409,

      retryable:
        true,

      exposeMessage:
        false,

      orderId:
        order.id,

      details: {
        expectedTickets,
        availableTickets,
      },
    });
  }

  if (
    !normalizeText(
      order.customerEmail,
    )
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_INVALID_REQUEST",

      message:
        "L’adresse e-mail du client est absente.",

      status:
        409,

      orderId:
        order.id,
    });
  }

  return order;
}

function buildTicketRows({
  order,
}: {
  order: OrderEmailData;
}): string {
  return order.items
    .map(
      (
        item,
      ) => {
        const feePerTicket =
          divideAmount({
            amount:
              item.platformFee,

            quantity:
              item.quantity,
          });

        const totalPerTicket =
          divideAmount({
            amount:
              item.total,

            quantity:
              item.quantity,
          });

        const ticketCodes =
          item.tickets
            .map(
              (
                ticket,
              ) =>
                escapeHtml(
                  ticket.code,
                ),
            )
            .join(
              "<br />",
            );

        return `
          <tr>
            <td style="padding:14px;border-bottom:1px solid #e8ecef;vertical-align:top;">
              <div style="font-weight:800;color:#101416;">${escapeHtml(
                item.ticketType.name,
              )}</div>
              ${
                item.ticketType.description
                  ? `<div style="margin-top:4px;font-size:12px;line-height:18px;color:#6b7378;">${escapeHtml(
                      item.ticketType.description,
                    )}</div>`
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
      },
    )
    .join(
      "",
    );
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
      (
        total,
        item,
      ) =>
        total +
        item.quantity,
      0,
    );

  const orderTotal =
    order.items.reduce(
      (
        total,
        item,
      ) =>
        total.plus(
          item.total,
        ),
      new Prisma.Decimal(
        0,
      ),
    );

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
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
              <td style="height:8px;background:linear-gradient(90deg,#16a766 0%,#a3e635 50%,#f97316 100%);"></td>
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
                  )}, votre commande <strong style="color:#ffffff;">${escapeHtml(
                    order.reference,
                  )}</strong> a été confirmée.
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
                            .filter(
                              Boolean,
                            )
                            .join(
                              ", ",
                            ),
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
                    Chaque PDF contient un QR code unique et signé. Présentez le PDF ou le QR code à l’entrée de l’événement.
                  </div>
                </div>

                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:26px;">
                  <tr>
                    <td>
                      <a href="${escapeHtml(
                        ticketsUrl,
                      )}" style="display:inline-block;padding:13px 20px;border-radius:12px;background:#a3e635;color:#071015;text-decoration:none;font-size:14px;font-weight:900;">
                        Voir mes billets
                      </a>
                    </td>

                    <td style="padding-left:10px;">
                      <a href="${escapeHtml(
                        ordersUrl,
                      )}" style="display:inline-block;padding:13px 20px;border-radius:12px;background:#071015;color:#ffffff;text-decoration:none;font-size:14px;font-weight:800;">
                        Voir ma commande
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:26px 0 0;font-size:12px;line-height:20px;color:#7b8489;">
                  Pour consulter la page de l’événement :
                  <a href="${escapeHtml(
                    eventUrl,
                  )}" style="color:#17894b;font-weight:700;text-decoration:none;">
                    ouvrir l’événement
                  </a>
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:18px 30px;background:#071015;font-size:11px;line-height:18px;color:#8f999e;">
                Cet e-mail a été envoyé automatiquement par Tikemia. Ne partagez pas vos billets ni leurs QR codes avant le contrôle d’accès.
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
  const lines =
    [
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
        .filter(
          Boolean,
        )
        .join(
          ", ",
        )}`,
      "",
      "Billets :",
    ];

  for (
    const item of
    order.items
  ) {
    const feePerTicket =
      divideAmount({
        amount:
          item.platformFee,

        quantity:
          item.quantity,
      });

    const totalPerTicket =
      divideAmount({
        amount:
          item.total,

        quantity:
          item.quantity,
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

    for (
      const ticket of
      item.tickets
    ) {
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

  return lines.join(
    "\n",
  );
}

function buildAttachments(
  generatedPdfs:
    GeneratedTicketPdf[],
): Array<{
  filename: string;
  content: Buffer;
}> {
  const totalSize =
    generatedPdfs.reduce(
      (
        total,
        pdf,
      ) =>
        total +
        pdf.fileSize,
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

      status:
        413,

      retryable:
        false,

      exposeMessage:
        false,

      details: {
        totalSize,
        limit:
          MAX_ATTACHMENTS_BYTES,
      },
    });
  }

  return generatedPdfs.map(
    (
      pdf,
    ) => ({
      filename:
        pdf.fileName,

      content:
        pdf.buffer,
    }),
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
  return database
    .deliveryLog
    .findFirst({
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
      },

      orderBy: {
        sentAt:
          "desc",
      },

      select: {
        id:
          true,

        providerMessageId:
          true,

        sentAt:
          true,
      },
    });
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

  const database:
    DatabaseClient =
    transaction ??
    prisma;

  const order =
    await getOrderEmailData({
      database,
      orderId,
    });

  const recipient =
    order.customerEmail
      .trim()
      .toLowerCase();

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
    existingDelivery
      .providerMessageId
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
        existingDelivery
          .providerMessageId,

      attachmentsCount:
        order.items.reduce(
          (
            total,
            item,
          ) =>
            total +
            item.tickets.length,
          0,
        ),

      totalAttachmentsSize:
        0,

      deliveryLogIds: [
        existingDelivery.id,
      ],

      sentAt:
        (
          existingDelivery
            .sentAt ??
          generatedAt
        ).toISOString(),
    };
  }

  const generatedPdfs =
    await generateOrderTicketPdfs({
      orderId:
        order.id,

      transaction,

      logoPath,

      generatedAt,
    });

  const attachments =
    buildAttachments(
      generatedPdfs.tickets,
    );

  const totalAttachmentsSize =
    generatedPdfs.tickets.reduce(
      (
        total,
        pdf,
      ) =>
        total +
        pdf.fileSize,
      0,
    );

  const configuration =
    getEmailConfiguration();

  const resend =
    getResendClient();

  const idempotencyKey =
    getEmailIdempotencyKey({
      orderId:
        order.id,

      recipient,
    });

  const response =
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
          normalizeText(
            replyTo,
          ) ||
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

  if (
    response.error ||
    !response.data?.id
  ) {
    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        "Impossible d’envoyer les billets par e-mail.",

      status:
        502,

      retryable:
        true,

      exposeMessage:
        false,

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

  const deliveryLogs =
    await database
      .deliveryLog
      .findMany({
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

          status: {
            in: [
              DeliveryStatus.PENDING,
              DeliveryStatus.PROCESSING,
              DeliveryStatus.FAILED,
            ],
          },
        },

        select: {
          id:
            true,

          ticketId:
            true,
        },
      });

  const deliveryLogIds =
    deliveryLogs.map(
      (
        log,
      ) =>
        log.id,
    );

  if (
    deliveryLogIds.length >
    0
  ) {
    await database
      .deliveryLog
      .updateMany({
        where: {
          id: {
            in:
              deliveryLogIds,
          },
        },

        data: {
          status:
            DeliveryStatus.SENT,

          provider:
            PROVIDER,

          providerMessageId:
            response.data.id,

          sentAt,

          deliveredAt:
            null,

          failedAt:
            null,

          errorCode:
            null,

          errorMessage:
            null,

          attempts: {
            increment:
              1,
          },

          lastAttemptAt:
            sentAt,
        },
      });
  }

  for (
    const pdf of
    generatedPdfs.tickets
  ) {
    await database
      .ticketDocument
      .upsert({
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