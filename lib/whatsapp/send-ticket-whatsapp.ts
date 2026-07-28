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
} from "@prisma/client";

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

export type SendTicketWhatsAppOptions = {
  orderId: string;

  transaction?: Prisma.TransactionClient;

  forceResend?: boolean;

  logoPath?: string;

  generatedAt?: Date;
};

export type SendTicketWhatsAppResult = {
  orderId: string;
  orderReference: string;

  recipient: string;

  provider: "META_WHATSAPP";

  providerMessageIds: string[];

  sentMessages: number;

  sentDocuments: number;

  deliveryLogIds: string[];

  sentAt: string;
};

type OrderWhatsAppData = {
  id: string;
  reference: string;
  status: OrderStatus;
  currency: string;

  customerName: string;
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

type MetaWhatsAppSendResponse = {
  messaging_product?: string;

  contacts?: Array<{
    input?: string;
    wa_id?: string;
  }>;

  messages?: Array<{
    id?: string;
    message_status?: string;
  }>;

  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

type MetaWhatsAppUploadResponse = {
  id?: string;

  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

const PROVIDER =
  "META_WHATSAPP";

const MAX_DOCUMENT_BYTES =
  100 * 1024 * 1024;

let cachedWhatsAppConfig:
  | {
      accessToken: string;
      phoneNumberId: string;
      apiVersion: string;
      businessAccountId: string | null;
    }
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

function normalizePhoneNumber(
  value: string,
): string {
  const normalized =
    value.replace(
      /[^\d+]/g,
      "",
    );

  const digitsOnly =
    normalized.replace(
      /\D/g,
      "",
    );

  if (
    digitsOnly.length <
      8 ||
    digitsOnly.length >
      15
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_INVALID_REQUEST",

      message:
        "Le numéro WhatsApp du client est invalide.",

      status:
        409,
    });
  }

  return digitsOnly;
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

function getWhatsAppConfiguration(): {
  accessToken: string;
  phoneNumberId: string;
  apiVersion: string;
  businessAccountId: string | null;
} {
  if (
    cachedWhatsAppConfig
  ) {
    return cachedWhatsAppConfig;
  }

  const accessToken =
    normalizeText(
      process.env
        .WHATSAPP_ACCESS_TOKEN,
    );

  const phoneNumberId =
    normalizeText(
      process.env
        .WHATSAPP_PHONE_NUMBER_ID,
    );

  const apiVersion =
    normalizeText(
      process.env
        .WHATSAPP_API_VERSION,
    ) ||
    "v23.0";

  const businessAccountId =
    normalizeText(
      process.env
        .WHATSAPP_BUSINESS_ACCOUNT_ID,
    ) ||
    null;

  if (
    !accessToken ||
    !phoneNumberId
  ) {
    throw new PaymentError({
      code:
        "PAYMENT_CONFIGURATION_ERROR",

      message:
        "La configuration WhatsApp est incomplète.",

      status:
        500,

      retryable:
        false,

      exposeMessage:
        false,
    });
  }

  cachedWhatsAppConfig = {
    accessToken,
    phoneNumberId,
    apiVersion,
    businessAccountId,
  };

  return cachedWhatsAppConfig;
}

function getWhatsAppMessagesUrl(): string {
  const config =
    getWhatsAppConfiguration();

  return `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;
}

function getWhatsAppMediaUrl(): string {
  const config =
    getWhatsAppConfiguration();

  return `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/media`;
}

function getWhatsAppIdempotencyKey({
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
      `tikemia:ticket-whatsapp:${orderId}:${recipient}`,
      "utf8",
    )
    .digest(
      "hex",
    );
}

async function parseMetaResponse<T>(
  response: Response,
): Promise<T> {
  let payload:
    unknown;

  try {
    payload =
      await response.json();
  } catch {
    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        "WhatsApp a retourné une réponse invalide.",

      status:
        502,

      retryable:
        true,

      exposeMessage:
        false,
    });
  }

  if (
    !response.ok
  ) {
    const metaError =
      payload as {
        error?: {
          message?: string;
          type?: string;
          code?: number;
          error_subcode?: number;
          fbtrace_id?: string;
        };
      };

    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        metaError.error
          ?.message ||
        "WhatsApp a refusé l’envoi du billet.",

      status:
        response.status,

      retryable:
        response.status >=
          500 ||
        response.status ===
          429,

      exposeMessage:
        false,

      details: {
        provider:
          PROVIDER,

        providerError:
          metaError.error ??
          null,
      },
    });
  }

  return payload as T;
}

async function getOrderWhatsAppData({
  database,
  orderId,
}: {
  database: DatabaseClient;
  orderId: string;
}): Promise<OrderWhatsAppData> {
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
    expectedTickets !==
      availableTickets
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
      order.customerPhone,
    )
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_INVALID_REQUEST",

      message:
        "Le numéro WhatsApp du client est absent.",

      status:
        409,

      orderId:
        order.id,
    });
  }

  return order;
}

function buildWhatsAppSummary({
  order,
}: {
  order: OrderWhatsAppData;
}): string {
  const appUrl =
    getApplicationUrl();

  const ticketsUrl =
    `${appUrl}/account/tickets`;

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

  const lines =
    [
      "🎟️ *TIKEMIA — Billets confirmés*",
      "",
      `Bonjour *${order.customerName}*,`,
      "",
      `Votre paiement pour la commande *${order.reference}* est confirmé.`,
      "",
      `*Événement*`,
      order.event.title,
      "",
      `📅 ${formatDateTime(
        order.event.startsAt,
      )}`,
      `📍 ${[
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
      `*Billets : ${totalTickets}*`,
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
      "",
      `• *${item.ticketType.name}*`,
      `  Quantité : ${item.quantity}`,
      `  Prix : ${formatMoney({
        amount:
          decimalToFixed(
            item.unitPrice,
          ),
        currency:
          order.currency,
      })}`,
      `  Frais par billet : ${formatMoney({
        amount:
          decimalToFixed(
            feePerTicket,
          ),
        currency:
          order.currency,
      })}`,
      `  Total par billet : ${formatMoney({
        amount:
          decimalToFixed(
            totalPerTicket,
          ),
        currency:
          order.currency,
      })}`,
      `  Codes : ${item.tickets
        .map(
          (
            ticket,
          ) =>
            ticket.code,
        )
        .join(
          ", ",
        )}`,
    );
  }

  lines.push(
    "",
    "Chaque PDF contient un QR code unique, réel et signé par Tikemia.",
    "Présentez le PDF ou le QR code à l’entrée.",
    "",
    `Mes billets : ${ticketsUrl}`,
  );

  return lines.join(
    "\n",
  );
}

function buildDocumentCaption({
  order,
  pdf,
}: {
  order: OrderWhatsAppData;
  pdf: GeneratedTicketPdf;
}): string {
  return [
    `🎫 *${pdf.metadata.ticketCategory}*`,
    `Code : ${pdf.ticketCode}`,
    `Prix : ${formatMoney({
      amount:
        pdf.metadata.unitPrice,
      currency:
        pdf.metadata.currency,
    })}`,
    `Total : ${formatMoney({
      amount:
        pdf.metadata.totalPerTicket,
      currency:
        pdf.metadata.currency,
    })}`,
    `Événement : ${order.event.title}`,
  ].join(
    "\n",
  );
}

async function sendWhatsAppText({
  recipient,
  text,
}: {
  recipient: string;
  text: string;
}): Promise<string> {
  const config =
    getWhatsAppConfiguration();

  const response =
    await fetch(
      getWhatsAppMessagesUrl(),
      {
        method:
          "POST",

        headers: {
          Authorization:
            `Bearer ${config.accessToken}`,

          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            messaging_product:
              "whatsapp",

            recipient_type:
              "individual",

            to:
              recipient,

            type:
              "text",

            text: {
              preview_url:
                false,

              body:
                text,
            },
          }),
      },
    );

  const payload =
    await parseMetaResponse<
      MetaWhatsAppSendResponse
    >(
      response,
    );

  const messageId =
    payload.messages?.[0]
      ?.id;

  if (
    !messageId
  ) {
    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        "WhatsApp n’a retourné aucun identifiant de message.",

      status:
        502,

      retryable:
        true,

      exposeMessage:
        false,
    });
  }

  return messageId;
}

async function uploadWhatsAppDocument({
  pdf,
}: {
  pdf: GeneratedTicketPdf;
}): Promise<string> {
  if (
    pdf.fileSize >
    MAX_DOCUMENT_BYTES
  ) {
    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        "Le billet PDF dépasse la taille maximale autorisée par WhatsApp.",

      status:
        413,

      retryable:
        false,

      exposeMessage:
        false,

      details: {
        ticketId:
          pdf.ticketId,

        fileSize:
          pdf.fileSize,
      },
    });
  }

  const config =
    getWhatsAppConfiguration();

  const formData =
    new FormData();

  formData.append(
    "messaging_product",
    "whatsapp",
  );

  formData.append(
    "type",
    pdf.mimeType,
  );

  const pdfBytes =
    Uint8Array.from(
      pdf.bytes,
    );

  formData.append(
    "file",
    new Blob(
      [
        pdfBytes.buffer,
      ],
      {
        type:
          pdf.mimeType,
      },
    ),
    pdf.fileName,
  );

  const response =
    await fetch(
      getWhatsAppMediaUrl(),
      {
        method:
          "POST",

        headers: {
          Authorization:
            `Bearer ${config.accessToken}`,
        },

        body:
          formData,
      },
    );

  const payload =
    await parseMetaResponse<
      MetaWhatsAppUploadResponse
    >(
      response,
    );

  if (
    !payload.id
  ) {
    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        "WhatsApp n’a retourné aucun identifiant de média.",

      status:
        502,

      retryable:
        true,

      exposeMessage:
        false,
    });
  }

  return payload.id;
}

async function sendWhatsAppDocument({
  recipient,
  mediaId,
  fileName,
  caption,
}: {
  recipient: string;
  mediaId: string;
  fileName: string;
  caption: string;
}): Promise<string> {
  const config =
    getWhatsAppConfiguration();

  const response =
    await fetch(
      getWhatsAppMessagesUrl(),
      {
        method:
          "POST",

        headers: {
          Authorization:
            `Bearer ${config.accessToken}`,

          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            messaging_product:
              "whatsapp",

            recipient_type:
              "individual",

            to:
              recipient,

            type:
              "document",

            document: {
              id:
                mediaId,

              filename:
                fileName,

              caption,
            },
          }),
      },
    );

  const payload =
    await parseMetaResponse<
      MetaWhatsAppSendResponse
    >(
      response,
    );

  const messageId =
    payload.messages?.[0]
      ?.id;

  if (
    !messageId
  ) {
    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        "WhatsApp n’a retourné aucun identifiant de message document.",

      status:
        502,

      retryable:
        true,

      exposeMessage:
        false,
    });
  }

  return messageId;
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
          DeliveryChannel.WHATSAPP,

        type:
          DeliveryType.TICKET_PDF,

        status:
          DeliveryStatus.SENT,

        recipient,
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

export async function sendTicketWhatsApp({
  orderId: rawOrderId,
  transaction,
  forceResend = false,
  logoPath,
  generatedAt = new Date(),
}: SendTicketWhatsAppOptions): Promise<
  SendTicketWhatsAppResult
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
    await getOrderWhatsAppData({
      database,
      orderId,
    });

  const recipient =
    normalizePhoneNumber(
      order.customerPhone,
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

      providerMessageIds: [
        existingDelivery
          .providerMessageId,
      ],

      sentMessages:
        1,

      sentDocuments:
        order.items.reduce(
          (
            total,
            item,
          ) =>
            total +
            item.tickets.length,
          0,
        ),

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

  const providerMessageIds:
    string[] =
    [];

  const summaryMessageId =
    await sendWhatsAppText({
      recipient,

      text:
        buildWhatsAppSummary({
          order,
        }),
    });

  providerMessageIds.push(
    summaryMessageId,
  );

  for (
    const pdf of
    generatedPdfs.tickets
  ) {
    const mediaId =
      await uploadWhatsAppDocument({
        pdf,
      });

    const documentMessageId =
      await sendWhatsAppDocument({
        recipient,

        mediaId,

        fileName:
          pdf.fileName,

        caption:
          buildDocumentCaption({
            order,
            pdf,
          }),
      });

    providerMessageIds.push(
      documentMessageId,
    );
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
            DeliveryChannel.WHATSAPP,

          type:
            DeliveryType.TICKET_PDF,

          recipient,

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
            providerMessageIds.join(
              ",",
            ),

          sentAt,

          deliveredAt:
            null,

          failedAt:
            null,

          errorCode:
            null,

          errorMessage:
            null,

          lastAttemptAt:
            sentAt,
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

    providerMessageIds,

    sentMessages:
      providerMessageIds.length,

    sentDocuments:
      generatedPdfs
        .tickets
        .length,

    deliveryLogIds,

    sentAt:
      sentAt.toISOString(),
  };
}

export function getTicketWhatsAppIdempotencyKey({
  orderId,
  recipient,
}: {
  orderId: string;
  recipient: string;
}): string {
  return getWhatsAppIdempotencyKey({
    orderId:
      normalizeIdentifier({
        value:
          orderId,

        field:
          "orderId",
      }),

    recipient:
      normalizePhoneNumber(
        recipient,
      ),
  });
}