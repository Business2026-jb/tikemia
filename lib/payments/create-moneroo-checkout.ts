import "server-only";

import {
  OrderStatus,
  PaymentStatus,
  Prisma,
  TicketReservationStatus,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  createMonerooCheckout as createMonerooProviderCheckout,
  type MonerooCheckoutResult,
} from "@/lib/payments/providers/moneroo/moneroo-provider";
import { MonerooError } from "@/lib/payments/providers/moneroo/moneroo-errors";

const MONEROO_PROVIDER = "MONEROO";
const MONEROO_METHOD = "MONEROO_CHECKOUT";

export type CreateMonerooCheckoutForOrderInput = Readonly<{
  orderId: string;
  returnUrl: string;
  idempotencyKey?: string;
  signal?: AbortSignal;
}>;

export type CreateMonerooCheckoutForOrderResult = Readonly<{
  paymentId: string;
  paymentAttemptId: string | null;
  provider: typeof MONEROO_PROVIDER;
  providerTransactionId: string;
  providerReference: string | null;
  checkoutUrl: string;
  status: PaymentStatus;
  reused: boolean;
}>;

export class MonerooCheckoutCreationError extends Error {
  readonly code: string;
  readonly causeValue: unknown;

  constructor(
    message: string,
    code: string,
    causeValue?: unknown,
  ) {
    super(message, { cause: causeValue });

    this.name = "MonerooCheckoutCreationError";
    this.code = code;
    this.causeValue = causeValue;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function normalizeRequiredText(
  value: string,
  fieldName: string,
): string {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new MonerooCheckoutCreationError(
      `${fieldName} est obligatoire.`,
      "MONEROO_CHECKOUT_INPUT_INVALID",
    );
  }

  return normalizedValue;
}

function validateReturnUrl(value: string): string {
  const normalizedValue = normalizeRequiredText(
    value,
    "L'URL de retour",
  );

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(normalizedValue);
  } catch {
    throw new MonerooCheckoutCreationError(
      "L'URL de retour Moneroo est invalide.",
      "MONEROO_RETURN_URL_INVALID",
    );
  }

  if (!["https:", "http:"].includes(parsedUrl.protocol)) {
    throw new MonerooCheckoutCreationError(
      "L'URL de retour Moneroo doit utiliser HTTP ou HTTPS.",
      "MONEROO_RETURN_URL_INVALID",
    );
  }

  if (
    process.env.NODE_ENV === "production" &&
    parsedUrl.protocol !== "https:"
  ) {
    throw new MonerooCheckoutCreationError(
      "L'URL de retour Moneroo doit utiliser HTTPS en production.",
      "MONEROO_RETURN_URL_NOT_SECURE",
    );
  }

  return parsedUrl.toString();
}

function splitCustomerName(
  customerName: string,
): Readonly<{
  firstName: string;
  lastName: string;
}> {
  const normalizedName = customerName.trim();
  const parts = normalizedName.split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return {
      firstName: "Client",
      lastName: "Tikemia",
    };
  }

  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: "Tikemia",
    };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function serializeError(error: unknown): Readonly<{
  code: string;
  message: string;
  payload: Prisma.InputJsonValue;
}> {
  if (error instanceof MonerooError) {
    return {
      code: error.code,
      message: error.message,
      payload: toJsonValue({
        name: error.name,
        code: error.code,
        status: error.status,
        endpoint: error.endpoint,
        method: error.method,
        responseBody: error.responseBody,
      }),
    };
  }

  if (error instanceof Error) {
    return {
      code: "MONEROO_CHECKOUT_CREATION_FAILED",
      message: error.message,
      payload: toJsonValue({
        name: error.name,
        message: error.message,
      }),
    };
  }

  return {
    code: "MONEROO_CHECKOUT_CREATION_FAILED",
    message: "Une erreur inconnue est survenue pendant la création du paiement.",
    payload: toJsonValue({
      value: String(error),
    }),
  };
}

function buildAttemptIdempotencyKey(
  paymentId: string,
  attemptNumber: number,
  requestedKey?: string,
): string {
  const normalizedRequestedKey = requestedKey?.trim();

  if (normalizedRequestedKey) {
    return `moneroo:${normalizedRequestedKey}`;
  }

  return `moneroo:${paymentId}:attempt:${attemptNumber}`;
}

function assertOrderCanBePaid(order: {
  status: OrderStatus;
  total: Prisma.Decimal;
  reservationExpiresAt: Date | null;
  reservations: Array<{
    status: TicketReservationStatus;
    expiresAt: Date;
  }>;
}): void {
  if (order.status === OrderStatus.PAID) {
    throw new MonerooCheckoutCreationError(
      "Cette commande est déjà payée.",
      "ORDER_ALREADY_PAID",
    );
  }

  if (
    order.status === OrderStatus.CANCELLED ||
    order.status === OrderStatus.EXPIRED ||
    order.status === OrderStatus.REFUNDED ||
    order.status === OrderStatus.FAILED
  ) {
    throw new MonerooCheckoutCreationError(
      "Cette commande ne peut plus être payée.",
      "ORDER_NOT_PAYABLE",
    );
  }

  if (
    order.status !== OrderStatus.PENDING &&
    order.status !== OrderStatus.PROCESSING
  ) {
    throw new MonerooCheckoutCreationError(
      "Le statut actuel de la commande ne permet pas de créer un paiement.",
      "ORDER_STATUS_INVALID",
    );
  }

  if (order.total.lessThanOrEqualTo(0)) {
    throw new MonerooCheckoutCreationError(
      "Le montant de la commande doit être supérieur à zéro.",
      "ORDER_AMOUNT_INVALID",
    );
  }

  const now = new Date();

  if (
    order.reservationExpiresAt &&
    order.reservationExpiresAt.getTime() <= now.getTime()
  ) {
    throw new MonerooCheckoutCreationError(
      "La réservation de cette commande a expiré.",
      "ORDER_RESERVATION_EXPIRED",
    );
  }

  const invalidReservation = order.reservations.find(
    (reservation) =>
      reservation.status !== TicketReservationStatus.PENDING ||
      reservation.expiresAt.getTime() <= now.getTime(),
  );

  if (invalidReservation) {
    throw new MonerooCheckoutCreationError(
      "Une réservation liée à cette commande n'est plus valide.",
      "TICKET_RESERVATION_INVALID",
    );
  }
}

function canReuseExistingCheckout(payment: {
  provider: string;
  status: PaymentStatus;
  checkoutUrl: string | null;
  providerTransactionId: string | null;
  expiresAt: Date | null;
}): boolean {
  if (payment.provider !== MONEROO_PROVIDER) {
    return false;
  }

  if (
    payment.status !== PaymentStatus.PENDING &&
    payment.status !== PaymentStatus.PROCESSING
  ) {
    return false;
  }

  if (!payment.checkoutUrl || !payment.providerTransactionId) {
    return false;
  }

  if (payment.expiresAt && payment.expiresAt.getTime() <= Date.now()) {
    return false;
  }

  return true;
}

export async function createMonerooCheckoutForOrder(
  input: CreateMonerooCheckoutForOrderInput,
): Promise<CreateMonerooCheckoutForOrderResult> {
  const orderId = normalizeRequiredText(
    input.orderId,
    "L'identifiant de la commande",
  );
  const returnUrl = validateReturnUrl(input.returnUrl);

  const order = await prisma.order.findUnique({
    where: {
      id: orderId,
    },
    select: {
      id: true,
      reference: true,
      customerName: true,
      customerEmail: true,
      customerPhone: true,
      currency: true,
      total: true,
      status: true,
      reservationExpiresAt: true,
      event: {
        select: {
          id: true,
          title: true,
          countryCode: true,
        },
      },
      reservations: {
        select: {
          status: true,
          expiresAt: true,
        },
      },
      payment: {
        select: {
          id: true,
          provider: true,
          providerReference: true,
          providerTransactionId: true,
          checkoutUrl: true,
          status: true,
          expiresAt: true,
        },
      },
    },
  });

  if (!order) {
    throw new MonerooCheckoutCreationError(
      "La commande demandée est introuvable.",
      "ORDER_NOT_FOUND",
    );
  }

  assertOrderCanBePaid(order);

  if (order.payment?.status === PaymentStatus.SUCCESS) {
    throw new MonerooCheckoutCreationError(
      "Le paiement de cette commande est déjà confirmé.",
      "PAYMENT_ALREADY_SUCCESSFUL",
    );
  }

  if (
    order.payment &&
    canReuseExistingCheckout(order.payment)
  ) {
    return Object.freeze({
      paymentId: order.payment.id,
      paymentAttemptId: null,
      provider: MONEROO_PROVIDER,
      providerTransactionId:
        order.payment.providerTransactionId as string,
      providerReference: order.payment.providerReference,
      checkoutUrl: order.payment.checkoutUrl as string,
      status: order.payment.status,
      reused: true,
    });
  }

  const amount = order.total.toNumber();

  if (!Number.isSafeInteger(amount)) {
    throw new MonerooCheckoutCreationError(
      "Le montant de cette commande doit être un entier compatible avec Moneroo.",
      "ORDER_AMOUNT_NOT_INTEGER",
    );
  }

  const customerName = splitCustomerName(order.customerName);

  const prepared = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.upsert({
      where: {
        orderId: order.id,
      },
      create: {
        orderId: order.id,
        provider: MONEROO_PROVIDER,
        method: MONEROO_METHOD,
        amount: order.total,
        currency: order.currency.toUpperCase(),
        status: PaymentStatus.PROCESSING,
        returnUrl,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        idempotencyKey: `moneroo:payment:${order.id}`,
        initiatedAt: new Date(),
        expiresAt: order.reservationExpiresAt,
        metadata: toJsonValue({
          orderId: order.id,
          orderReference: order.reference,
          eventId: order.event.id,
          eventTitle: order.event.title,
          countryCode: order.event.countryCode,
        }),
      },
      update: {
        provider: MONEROO_PROVIDER,
        method: MONEROO_METHOD,
        amount: order.total,
        currency: order.currency.toUpperCase(),
        status: PaymentStatus.PROCESSING,
        checkoutUrl: null,
        returnUrl,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        failureCode: null,
        failureReason: null,
        initiatedAt: new Date(),
        processingAt: new Date(),
        failedAt: null,
        cancelledAt: null,
        expiresAt: order.reservationExpiresAt,
        metadata: toJsonValue({
          orderId: order.id,
          orderReference: order.reference,
          eventId: order.event.id,
          eventTitle: order.event.title,
          countryCode: order.event.countryCode,
        }),
      },
      select: {
        id: true,
      },
    });

    const attemptCount = await tx.paymentAttempt.count({
      where: {
        paymentId: payment.id,
      },
    });

    const attemptNumber = attemptCount + 1;
    const idempotencyKey = buildAttemptIdempotencyKey(
      payment.id,
      attemptNumber,
      input.idempotencyKey,
    );

    const attempt = await tx.paymentAttempt.create({
      data: {
        paymentId: payment.id,
        provider: MONEROO_PROVIDER,
        method: MONEROO_METHOD,
        amount: order.total,
        currency: order.currency.toUpperCase(),
        status: PaymentStatus.PROCESSING,
        idempotencyKey,
        initiatedAt: new Date(),
        processingAt: new Date(),
        expiresAt: order.reservationExpiresAt,
        requestPayload: toJsonValue({
          orderId: order.id,
          orderReference: order.reference,
          amount,
          currency: order.currency.toUpperCase(),
          returnUrl,
          customer: {
            email: order.customerEmail,
            firstName: customerName.firstName,
            lastName: customerName.lastName,
            phone: order.customerPhone,
          },
          metadata: {
            orderId: order.id,
            orderReference: order.reference,
            eventId: order.event.id,
          },
        }),
      },
      select: {
        id: true,
        idempotencyKey: true,
      },
    });

    await tx.order.update({
      where: {
        id: order.id,
      },
      data: {
        status: OrderStatus.PROCESSING,
        checkoutStartedAt: new Date(),
      },
    });

    return {
      paymentId: payment.id,
      paymentAttemptId: attempt.id,
      idempotencyKey: attempt.idempotencyKey,
    };
  });

  let providerResult: MonerooCheckoutResult;

  try {
    providerResult = await createMonerooProviderCheckout(
      {
        amount,
        currency: order.currency,
        description: `Commande ${order.reference} - ${order.event.title}`,
        returnUrl,
        customer: {
          email: order.customerEmail,
          firstName: customerName.firstName,
          lastName: customerName.lastName,
          phone: order.customerPhone,
          countryCode: order.event.countryCode,
        },
        metadata: {
          orderId: order.id,
          orderReference: order.reference,
          eventId: order.event.id,
        },
      },
      {
        signal: input.signal,
        idempotencyKey: prepared.idempotencyKey ?? undefined,
      },
    );
  } catch (error) {
    const serializedError = serializeError(error);
    const failedAt = new Date();

    await prisma.$transaction([
      prisma.paymentAttempt.update({
        where: {
          id: prepared.paymentAttemptId,
        },
        data: {
          status: PaymentStatus.FAILED,
          failureCode: serializedError.code,
          failureReason: serializedError.message,
          responsePayload: serializedError.payload,
          failedAt,
        },
      }),
      prisma.payment.update({
        where: {
          id: prepared.paymentId,
        },
        data: {
          status: PaymentStatus.FAILED,
          failureCode: serializedError.code,
          failureReason: serializedError.message,
          failedAt,
        },
      }),
      prisma.order.update({
        where: {
          id: order.id,
        },
        data: {
          status: OrderStatus.PENDING,
        },
      }),
    ]);

    throw new MonerooCheckoutCreationError(
      serializedError.message,
      serializedError.code,
      error,
    );
  }

  await prisma.$transaction([
    prisma.payment.update({
      where: {
        id: prepared.paymentId,
      },
      data: {
        provider: MONEROO_PROVIDER,
        providerTransactionId:
          providerResult.providerTransactionId,
        providerReference: providerResult.providerReference,
        checkoutUrl: providerResult.checkoutUrl,
        status: providerResult.status,
        processingAt: new Date(),
        failureCode: null,
        failureReason: null,
      },
    }),
    prisma.paymentAttempt.update({
      where: {
        id: prepared.paymentAttemptId,
      },
      data: {
        providerTransactionId:
          providerResult.providerTransactionId,
        providerReference: providerResult.providerReference,
        checkoutUrl: providerResult.checkoutUrl,
        status: providerResult.status,
        responsePayload: toJsonValue(providerResult.raw),
        processingAt: new Date(),
        failureCode: null,
        failureReason: null,
      },
    }),
  ]);

  return Object.freeze({
    paymentId: prepared.paymentId,
    paymentAttemptId: prepared.paymentAttemptId,
    provider: MONEROO_PROVIDER,
    providerTransactionId:
      providerResult.providerTransactionId,
    providerReference: providerResult.providerReference,
    checkoutUrl: providerResult.checkoutUrl,
    status: providerResult.status,
    reused: false,
  });
}

export async function createMonerooCheckout(
  input: CreateMonerooCheckoutForOrderInput,
): Promise<CreateMonerooCheckoutForOrderResult> {
  return createMonerooCheckoutForOrder(input);
}
