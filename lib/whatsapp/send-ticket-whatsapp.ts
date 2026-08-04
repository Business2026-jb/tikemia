import "server-only";

import { createHash } from "node:crypto";

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
import { prisma } from "@/lib/prisma";
import {
  generateOrderTicketPdfs,
  type GeneratedTicketPdf,
} from "@/lib/tickets/generate-ticket-pdf";

type DatabaseClient =
  | Prisma.TransactionClient
  | typeof prisma;

export type SendTicketWhatsAppOptions = {
  orderId: string;
  transaction?: Prisma.TransactionClient;
  forceResend?: boolean;
  logoPath?: string;
  generatedAt?: Date;
  signal?: AbortSignal;
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

  customerId: string | null;
  customerName: string;
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

type MetaWhatsAppError = {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
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

  error?: MetaWhatsAppError;
};

type MetaWhatsAppUploadResponse = {
  id?: string;
  error?: MetaWhatsAppError;
};

type WhatsAppConfiguration = Readonly<{
  accessToken: string;
  phoneNumberId: string;
  apiVersion: string;
  businessAccountId: string | null;
  requestTimeoutMs: number;
}>;

type TicketDeliveryTarget = Readonly<{
  ticketId: string;
  ticketCode: string;
}>;

const PROVIDER = "META_WHATSAPP" as const;

const DEFAULT_API_VERSION = "v23.0";
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

const MAX_REQUEST_TIMEOUT_MS = 120_000;
const MAX_DOCUMENT_BYTES = 100 * 1024 * 1024;
const MAX_CAPTION_LENGTH = 1_024;
const MAX_TEXT_LENGTH = 4_096;

let cachedWhatsAppConfig:
  | WhatsAppConfiguration
  | null = null;

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
      code: "PAYMENT_INVALID_REQUEST",

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
      code: "PAYMENT_INVALID_REQUEST",

      message:
        "La date de génération des billets est invalide.",

      status: 400,
    });
  }

  return value;
}

function normalizePhoneNumber(
  value: string | null | undefined,
): string {
  const digitsOnly =
    normalizeText(value).replace(
      /\D/g,
      "",
    );

  if (
    digitsOnly.length < 8 ||
    digitsOnly.length > 15
  ) {
    throw new PaymentValidationError({
      code: "PAYMENT_INVALID_REQUEST",

      message:
        "Le numéro WhatsApp du client est invalide.",

      status: 409,

      details: {
        phoneLength:
          digitsOnly.length,
      },
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

function truncateMessage(
  value: string,
  maximumLength: number,
): string {
  const normalized = value.trim();

  if (
    normalized.length <=
    maximumLength
  ) {
    return normalized;
  }

  return `${normalized.slice(
    0,
    Math.max(
      0,
      maximumLength - 3,
    ),
  )}...`;
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

function readRequestTimeoutMs(): number {
  const rawValue =
    normalizeText(
      process.env
        .WHATSAPP_REQUEST_TIMEOUT_MS,
    );

  if (!rawValue) {
    return DEFAULT_REQUEST_TIMEOUT_MS;
  }

  const parsedValue =
    Number(rawValue);

  if (
    !Number.isInteger(parsedValue) ||
    parsedValue < 1_000 ||
    parsedValue >
      MAX_REQUEST_TIMEOUT_MS
  ) {
    throw new PaymentError({
      code:
        "PAYMENT_CONFIGURATION_ERROR",

      message:
        "WHATSAPP_REQUEST_TIMEOUT_MS doit être compris entre 1000 et 120000.",

      status: 500,

      retryable: false,

      exposeMessage: false,
    });
  }

  return parsedValue;
}

function getWhatsAppConfiguration():
  WhatsAppConfiguration {
  if (cachedWhatsAppConfig) {
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
    DEFAULT_API_VERSION;

  const businessAccountId =
    normalizeText(
      process.env
        .WHATSAPP_BUSINESS_ACCOUNT_ID,
    ) || null;

  if (
    !accessToken ||
    !phoneNumberId
  ) {
    throw new PaymentError({
      code:
        "PAYMENT_CONFIGURATION_ERROR",

      message:
        "La configuration WhatsApp est incomplète.",

      status: 500,

      retryable: false,

      exposeMessage: false,
    });
  }

  if (
    !/^v\d+\.\d+$/.test(
      apiVersion,
    )
  ) {
    throw new PaymentError({
      code:
        "PAYMENT_CONFIGURATION_ERROR",

      message:
        "WHATSAPP_API_VERSION est invalide.",

      status: 500,

      retryable: false,

      exposeMessage: false,
    });
  }

  cachedWhatsAppConfig =
    Object.freeze({
      accessToken,
      phoneNumberId,
      apiVersion,
      businessAccountId,
      requestTimeoutMs:
        readRequestTimeoutMs(),
    });

  return cachedWhatsAppConfig;
}

function getWhatsAppMessagesUrl(
  config: WhatsAppConfiguration,
): string {
  return (
    `https://graph.facebook.com/` +
    `${config.apiVersion}/` +
    `${encodeURIComponent(
      config.phoneNumberId,
    )}/messages`
  );
}

function getWhatsAppMediaUrl(
  config: WhatsAppConfiguration,
): string {
  return (
    `https://graph.facebook.com/` +
    `${config.apiVersion}/` +
    `${encodeURIComponent(
      config.phoneNumberId,
    )}/media`
  );
}

function getWhatsAppIdempotencyKey({
  orderId,
  recipient,
}: {
  orderId: string;
  recipient: string;
}): string {
  return createHash("sha256")
    .update(
      `tikemia:ticket-whatsapp:${orderId}:${recipient}`,
      "utf8",
    )
    .digest("hex");
}

function createRequestSignal({
  timeoutMs,
  externalSignal,
}: {
  timeoutMs: number;
  externalSignal?: AbortSignal;
}): {
  signal: AbortSignal;
  cleanup: () => void;
  didTimeout: () => boolean;
} {
  const controller =
    new AbortController();

  let timedOut = false;

  const timeout = setTimeout(
    () => {
      timedOut = true;
      controller.abort();
    },
    timeoutMs,
  );

  const abortFromExternal =
    () => {
      controller.abort(
        externalSignal?.reason,
      );
    };

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(
        externalSignal.reason,
      );
    } else {
      externalSignal.addEventListener(
        "abort",
        abortFromExternal,
        {
          once: true,
        },
      );
    }
  }

  return {
    signal:
      controller.signal,

    cleanup: () => {
      clearTimeout(timeout);

      externalSignal
        ?.removeEventListener(
          "abort",
          abortFromExternal,
        );
    },

    didTimeout: () =>
      timedOut,
  };
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function extractMetaError(
  value: unknown,
): MetaWhatsAppError | null {
  if (!isRecord(value)) {
    return null;
  }

  const error =
    value.error;

  if (!isRecord(error)) {
    return null;
  }

  return {
    message:
      typeof error.message ===
      "string"
        ? error.message
        : undefined,

    type:
      typeof error.type ===
      "string"
        ? error.type
        : undefined,

    code:
      typeof error.code ===
      "number"
        ? error.code
        : undefined,

    error_subcode:
      typeof error.error_subcode ===
      "number"
        ? error.error_subcode
        : undefined,

    fbtrace_id:
      typeof error.fbtrace_id ===
      "string"
        ? error.fbtrace_id
        : undefined,
  };
}

async function parseMetaResponse<T>(
  response: Response,
): Promise<T> {
  const rawBody =
    await response.text();

  let payload: unknown = null;

  if (rawBody.trim()) {
    try {
      payload =
        JSON.parse(rawBody) as unknown;
    } catch {
      throw new PaymentError({
        code:
          "PAYMENT_TICKET_ISSUANCE_FAILED",

        message:
          "WhatsApp a retourné une réponse invalide.",

        status: 502,

        retryable: true,

        exposeMessage: false,

        details: {
          provider:
            PROVIDER,

          httpStatus:
            response.status,
        },
      });
    }
  }

  if (!response.ok) {
    const metaError =
      extractMetaError(payload);

    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        metaError?.message ||
        "WhatsApp a refusé l’envoi du billet.",

      status:
        response.status >= 400 &&
        response.status <= 599
          ? response.status
          : 502,

      retryable:
        response.status === 408 ||
        response.status === 429 ||
        response.status >= 500,

      exposeMessage: false,

      details: {
        provider:
          PROVIDER,

        httpStatus:
          response.status,

        providerError:
          metaError,
      },
    });
  }

  if (!isRecord(payload)) {
    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        "WhatsApp n’a retourné aucune donnée valide.",

      status: 502,

      retryable: true,

      exposeMessage: false,

      details: {
        provider:
          PROVIDER,
      },
    });
  }

  return payload as T;
}

async function executeMetaRequest<T>({
  url,
  init,
  signal,
}: {
  url: string;
  init: RequestInit;
  signal?: AbortSignal;
}): Promise<T> {
  const config =
    getWhatsAppConfiguration();

  const requestContext =
    createRequestSignal({
      timeoutMs:
        config.requestTimeoutMs,

      externalSignal:
        signal,
    });

  try {
    const response =
      await fetch(url, {
        ...init,

        cache: "no-store",

        signal:
          requestContext.signal,
      });

    return await parseMetaResponse<T>(
      response,
    );
  } catch (error) {
    if (
      error instanceof PaymentError ||
      error instanceof
        PaymentValidationError
    ) {
      throw error;
    }

    if (
      error instanceof DOMException &&
      error.name === "AbortError"
    ) {
      throw new PaymentError({
        code:
          "PAYMENT_TICKET_ISSUANCE_FAILED",

        message:
          requestContext.didTimeout()
            ? "La requête WhatsApp a dépassé le délai autorisé."
            : "La requête WhatsApp a été annulée.",

        status:
          requestContext.didTimeout()
            ? 504
            : 499,

        retryable:
          requestContext.didTimeout(),

        exposeMessage: false,

        cause: error,

        details: {
          provider:
            PROVIDER,
        },
      });
    }

    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        "Impossible de communiquer avec WhatsApp.",

      status: 502,

      retryable: true,

      exposeMessage: false,

      cause: error,

      details: {
        provider:
          PROVIDER,
      },
    });
  } finally {
    requestContext.cleanup();
  }
}

async function getOrderWhatsAppData({
  database,
  orderId,
}: {
  database: DatabaseClient;
  orderId: string;
}): Promise<OrderWhatsAppData> {
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
    expectedTickets !==
      availableTickets
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

  normalizePhoneNumber(
    order.customerPhone,
  );

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
      (total, item) =>
        total +
        item.quantity,
      0,
    );

  const lines = [
    "🎟️ *TIKEMIA — Billets confirmés*",
    "",
    `Bonjour *${order.customerName}*,`,
    "",
    `Votre paiement pour la commande *${order.reference}* est confirmé.`,
    "",
    "*Événement*",
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
      .filter(Boolean)
      .join(", ")}`,
    "",
    `*Billets : ${totalTickets}*`,
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
          (ticket) =>
            ticket.code,
        )
        .join(", ")}`,
    );
  }

  lines.push(
    "",
    "Chaque PDF contient un QR code unique et signé par Tikemia.",
    "Présentez le PDF ou le QR code à l’entrée.",
    "",
    `Mes billets : ${ticketsUrl}`,
  );

  return truncateMessage(
    lines.join("\n"),
    MAX_TEXT_LENGTH,
  );
}

function buildDocumentCaption({
  order,
  pdf,
}: {
  order: OrderWhatsAppData;
  pdf: GeneratedTicketPdf;
}): string {
  return truncateMessage(
    [
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
    ].join("\n"),

    MAX_CAPTION_LENGTH,
  );
}

function validateGeneratedPdf(
  pdf: GeneratedTicketPdf,
): void {
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
        "Le billet PDF à envoyer sur WhatsApp est invalide.",

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

  if (
    pdf.fileSize >
    MAX_DOCUMENT_BYTES
  ) {
    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        "Le billet PDF dépasse la taille maximale autorisée par WhatsApp.",

      status: 413,

      retryable: false,

      exposeMessage: false,

      details: {
        ticketId:
          pdf.ticketId,

        fileSize:
          pdf.fileSize,

        maximumSize:
          MAX_DOCUMENT_BYTES,
      },
    });
  }
}

async function sendWhatsAppText({
  recipient,
  text,
  signal,
}: {
  recipient: string;
  text: string;
  signal?: AbortSignal;
}): Promise<string> {
  const config =
    getWhatsAppConfiguration();

  const payload =
    await executeMetaRequest<
      MetaWhatsAppSendResponse
    >({
      url:
        getWhatsAppMessagesUrl(
          config,
        ),

      signal,

      init: {
        method: "POST",

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
              preview_url: false,
              body:
                truncateMessage(
                  text,
                  MAX_TEXT_LENGTH,
                ),
            },
          }),
      },
    });

  const messageId =
    normalizeText(
      payload.messages?.[0]?.id,
    );

  if (!messageId) {
    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        "WhatsApp n’a retourné aucun identifiant de message.",

      status: 502,

      retryable: true,

      exposeMessage: false,

      details: {
        provider:
          PROVIDER,
      },
    });
  }

  return messageId;
}

async function uploadWhatsAppDocument({
  pdf,
  signal,
}: {
  pdf: GeneratedTicketPdf;
  signal?: AbortSignal;
}): Promise<string> {
  validateGeneratedPdf(pdf);

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
      [pdfBytes],
      {
        type:
          pdf.mimeType,
      },
    ),

    pdf.fileName,
  );

  const payload =
    await executeMetaRequest<
      MetaWhatsAppUploadResponse
    >({
      url:
        getWhatsAppMediaUrl(
          config,
        ),

      signal,

      init: {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${config.accessToken}`,
        },

        body:
          formData,
      },
    });

  const mediaId =
    normalizeText(payload.id);

  if (!mediaId) {
    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        "WhatsApp n’a retourné aucun identifiant de média.",

      status: 502,

      retryable: true,

      exposeMessage: false,

      details: {
        provider:
          PROVIDER,

        ticketId:
          pdf.ticketId,
      },
    });
  }

  return mediaId;
}

async function sendWhatsAppDocument({
  recipient,
  mediaId,
  fileName,
  caption,
  signal,
}: {
  recipient: string;
  mediaId: string;
  fileName: string;
  caption: string;
  signal?: AbortSignal;
}): Promise<string> {
  const config =
    getWhatsAppConfiguration();

  const payload =
    await executeMetaRequest<
      MetaWhatsAppSendResponse
    >({
      url:
        getWhatsAppMessagesUrl(
          config,
        ),

      signal,

      init: {
        method: "POST",

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

              caption:
                truncateMessage(
                  caption,
                  MAX_CAPTION_LENGTH,
                ),
            },
          }),
      },
    });

  const messageId =
    normalizeText(
      payload.messages?.[0]?.id,
    );

  if (!messageId) {
    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        "WhatsApp n’a retourné aucun identifiant de message document.",

      status: 502,

      retryable: true,

      exposeMessage: false,

      details: {
        provider:
          PROVIDER,

        mediaId,
      },
    });
  }

  return messageId;
}

function getTicketDeliveryTargets(
  order: OrderWhatsAppData,
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
  return database.deliveryLog.findMany({
    where: {
      orderId,

      channel:
        DeliveryChannel.WHATSAPP,

      type:
        DeliveryType.TICKET_PDF,

      status:
        DeliveryStatus.SENT,

      recipient,

      providerMessageId: {
        not: null,
      },
    },

    orderBy: {
      sentAt: "desc",
    },

    select: {
      id: true,
      ticketId: true,
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
  order: OrderWhatsAppData;
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
          DeliveryChannel.WHATSAPP,

        type:
          DeliveryType.TICKET_PDF,

        recipient,

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
        ],
      ),
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
            DeliveryChannel.WHATSAPP,

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
          DeliveryStatus.PROCESSING,
          DeliveryStatus.FAILED,
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
    },
  });
}

async function markDeliveriesFailed({
  database,
  deliveryLogIds,
  failedAt,
  error,
}: {
  database: DatabaseClient;
  deliveryLogIds: string[];
  failedAt: Date;
  error: unknown;
}): Promise<void> {
  if (
    deliveryLogIds.length === 0
  ) {
    return;
  }

  const errorCode =
    error instanceof PaymentError
      ? error.code
      : "WHATSAPP_SEND_FAILED";

  const errorMessage =
    error instanceof Error
      ? error.message
      : "Impossible d’envoyer les billets par WhatsApp.";

  await database.deliveryLog
    .updateMany({
      where: {
        id: {
          in: deliveryLogIds,
        },
      },

      data: {
        status:
          DeliveryStatus.FAILED,

        provider:
          PROVIDER,

        failedAt,

        errorCode,

        errorMessage:
          errorMessage.slice(
            0,
            2_000,
          ),
      },
    })
    .catch(() => undefined);
}

async function markDeliveriesSent({
  database,
  deliveryLogIds,
  providerMessageIds,
  sentAt,
}: {
  database: DatabaseClient;
  deliveryLogIds: string[];
  providerMessageIds: string[];
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

      providerMessageId:
        providerMessageIds.join(","),

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

export async function sendTicketWhatsApp({
  orderId: rawOrderId,
  transaction,
  forceResend = false,
  logoPath,
  generatedAt = new Date(),
  signal,
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

  const validGeneratedAt =
    normalizeGeneratedAt(
      generatedAt,
    );

  const database: DatabaseClient =
    transaction ?? prisma;

  const order =
    await getOrderWhatsAppData({
      database,
      orderId,
    });

  const recipient =
    normalizePhoneNumber(
      order.customerPhone,
    );

  const ticketTargets =
    getTicketDeliveryTargets(order);

  const successfulDeliveries =
    await findExistingSuccessfulDelivery({
      database,

      orderId:
        order.id,

      recipient,
    });

  const successfulTicketIds =
    new Set(
      successfulDeliveries
        .map(
          (delivery) =>
            delivery.ticketId,
        )
        .filter(
          (
            ticketId,
          ): ticketId is string =>
            Boolean(ticketId),
        ),
    );

  const allTicketsAlreadySent =
    ticketTargets.length > 0 &&
    ticketTargets.every(
      (target) =>
        successfulTicketIds.has(
          target.ticketId,
        ),
    );

  if (
    allTicketsAlreadySent &&
    !forceResend
  ) {
    const providerMessageIds =
      Array.from(
        new Set(
          successfulDeliveries
            .flatMap(
              (delivery) =>
                normalizeText(
                  delivery
                    .providerMessageId,
                )
                  .split(",")
                  .map(
                    (messageId) =>
                      messageId.trim(),
                  )
                  .filter(Boolean),
            ),
        ),
      );

    const latestSentAt =
      successfulDeliveries
        .map(
          (delivery) =>
            delivery.sentAt,
        )
        .filter(
          (
            value,
          ): value is Date =>
            value instanceof Date,
        )
        .sort(
          (left, right) =>
            right.getTime() -
            left.getTime(),
        )[0] ??
      validGeneratedAt;

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
        ticketTargets.length,

      deliveryLogIds:
        successfulDeliveries.map(
          (delivery) =>
            delivery.id,
        ),

      sentAt:
        latestSentAt.toISOString(),
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

  if (
    generatedPdfs.tickets.length !==
    ticketTargets.length
  ) {
    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        "Le nombre de PDF ne correspond pas au nombre de billets.",

      status: 500,

      retryable: true,

      exposeMessage: false,

      orderId:
        order.id,

      details: {
        expected:
          ticketTargets.length,

        generated:
          generatedPdfs.tickets.length,
      },
    });
  }

  for (
    const pdf of
    generatedPdfs.tickets
  ) {
    validateGeneratedPdf(pdf);
  }

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

  const providerMessageIds:
    string[] = [];

  let sentDocuments = 0;

  try {
    const summaryMessageId =
      await sendWhatsAppText({
        recipient,

        text:
          buildWhatsAppSummary({
            order,
          }),

        signal,
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
          signal,
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

          signal,
        });

      providerMessageIds.push(
        documentMessageId,
      );

      sentDocuments += 1;
    }
  } catch (error) {
    await markDeliveriesFailed({
      database,
      deliveryLogIds,

      failedAt:
        new Date(),

      error,
    });

    throw error;
  }

  const sentAt = new Date();

  await markDeliveriesSent({
    database,
    deliveryLogIds,
    providerMessageIds,
    sentAt,
  });

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

    sentDocuments,

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