import { getTrustedRequestOrigin } from "@/lib/tikemia-pay/providers";
import { getProviderConnector } from "@/lib/payments/methods";
import { currencyDecimals, isSupportedCurrency } from "@/i18n/config";

import "server-only";

import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { getPlatformPrisma } from "@/lib/payments/fulfillment";


import {
  resolvePaymentSelection,
} from "@/lib/payments/methods";

import type {
  PaymentMoney,
  PaymentNextAction,
} from "@/lib/payments/types";

/**
 * =========================================================
 * TIKEMIA PAY — INITIALISATION SÉCURISÉE
 * =========================================================
 *
 * POST /api/checkout/pay
 *
 * Compatible :
 * - Commandes de billets
 * - Dons et cagnottes
 * - Clients invités
 * - Français / anglais
 * - Checkout public mobile et PC
 *
 * Sécurité :
 * - Autorisation par checkoutToken
 * - Montants calculés depuis PostgreSQL
 * - Vérification des prix et quantités
 * - Vérification des réservations
 * - Vérification des frais
 * - Vérification du moyen de paiement
 * - Verrouillage transactionnel
 * - Protection contre les doubles paiements
 * - Aucune confirmation fictive
 *
 * IMPORTANT :
 * Cette API ne génère aucun billet.
 * Elle ne confirme aucun don.
 *
 * La validation finale appartient au traitement
 * serveur des paiements confirmés.
 * =========================================================
 */


/* =========================================================
   CONSTANTES
========================================================= */

const CHECKOUT_CONTEXT =
  "tikemia:checkout-authorization:v1";

const STATUS_CONTEXT =
  "tikemia:checkout-status:v1";

const CHECKOUT_VALIDITY_MS =
  30 * 60 * 1000;

const MAX_BODY_BYTES = 4096;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TOKEN_PATTERN =
  /^[a-f0-9]{64}$/i;

const METHOD_PATTERN =
  /^[a-z][a-z0-9_]{0,79}$/;

const IDEMPOTENCY_PATTERN =
  /^[a-zA-Z0-9_.:-]{8,128}$/;

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PHONE_PATTERN =
  /^\+[1-9]\d{6,14}$/;

const RESPONSE_HEADERS = {
  "Cache-Control":
    "private, no-store, no-cache, must-revalidate",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  Vary: "Cookie",
} as const;

/* =========================================================
   TYPES
========================================================= */

type Locale = "fr" | "en";

type ResourceType = "tickets" | "donation";

type CheckoutBody = {
  type?: unknown;
  orderId?: unknown;
  donationId?: unknown;
  checkoutToken?: unknown;
  paymentMethodId?: unknown;
  methodId?: unknown;
  countryCode?: unknown;
  customer?: unknown;
  idempotencyKey?: unknown;
  locale?: unknown;
};

type CustomerInput = {
  email?: unknown;
  phone?: unknown;
  countryCode?: unknown;
};

type CheckoutResource = {
  type: ResourceType;
  id: string;
  createdAt: Date;
  amount: bigint;
  currency: string;
  email: string;
  phone: string;
  description: string;
};

type PaymentRecord = {
  provider: string;
  id: string;
  reference: string;
  status: string;
  providerRef: string | null;
  createdAt: Date;
};

type ApiErrorCode =
  | "INVALID_REQUEST"
  | "UNAUTHORIZED"
  | "CHECKOUT_EXPIRED"
  | "INVALID_CUSTOMER"
  | "INVALID_AMOUNT"
  | "INVALID_RESERVATION"
  | "METHOD_UNAVAILABLE"
  | "PAYMENT_ALREADY_STARTED"
  | "PAYMENT_UNAVAILABLE"
  | "PAYMENT_INITIATION_UNKNOWN"
  | "ORDER_STATE_CHANGED";

class CheckoutError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    public readonly statusCode = 400
  ) {
    super(code);
    this.name = "CheckoutError";
  }
}

/* =========================================================
   MESSAGES FRANÇAIS / ANGLAIS
========================================================= */

const MESSAGES: Record<
  Locale,
  Record<ApiErrorCode, string>
> = {
  fr: {
    INVALID_REQUEST:
      "Demande de paiement invalide.",

    UNAUTHORIZED:
      "Cette commande n'est pas autorisée.",

    CHECKOUT_EXPIRED:
      "La session de paiement a expiré.",

    INVALID_CUSTOMER:
      "Vérifiez vos coordonnées.",

    INVALID_AMOUNT:
      "Le montant de la commande est invalide.",

    INVALID_RESERVATION:
      "Les places réservées ne sont plus disponibles.",

    METHOD_UNAVAILABLE:
      "Ce moyen de paiement n'est pas disponible.",

    PAYMENT_ALREADY_STARTED:
      "Un paiement est déjà en cours pour cette commande.",

    PAYMENT_UNAVAILABLE:
      "Le service de paiement est temporairement indisponible.",

    PAYMENT_INITIATION_UNKNOWN:
      "Le paiement est en cours de vérification. Ne lancez pas un autre paiement.",

    ORDER_STATE_CHANGED:
      "La commande a changé. Actualisez votre page.",
  },

  en: {
    INVALID_REQUEST:
      "Invalid payment request.",

    UNAUTHORIZED:
      "This order is not authorized.",

    CHECKOUT_EXPIRED:
      "The payment session has expired.",

    INVALID_CUSTOMER:
      "Please verify your contact details.",

    INVALID_AMOUNT:
      "The order amount is invalid.",

    INVALID_RESERVATION:
      "Your reserved tickets are no longer available.",

    METHOD_UNAVAILABLE:
      "This payment method is unavailable.",

    PAYMENT_ALREADY_STARTED:
      "A payment is already in progress for this order.",

    PAYMENT_UNAVAILABLE:
      "The payment service is temporarily unavailable.",

    PAYMENT_INITIATION_UNKNOWN:
      "Payment verification is in progress. Do not start another payment.",

    ORDER_STATE_CHANGED:
      "The order has changed. Please refresh the page.",
  },
};

/* =========================================================
   RÉPONSES API
========================================================= */

function json(
  data: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(data, {
    status,
    headers: RESPONSE_HEADERS,
  });
}

function errorResponse(
  locale: Locale,
  code: ApiErrorCode,
  status: number,
  additional?: Record<string, unknown>
) {
  return json(
    {
      success: false,
      code,
      message: MESSAGES[locale][code],
      ...additional,
    },
    status
  );
}

/* =========================================================
   VALIDATION DE L'ORIGINE
========================================================= */

function validOrigin(
  request: NextRequest
): boolean {
  if (
    request.headers.get("sec-fetch-site") ===
    "cross-site"
  ) {
    return false;
  }

  const origin =
    request.headers.get("origin");

  if (!origin) {
    return true;
  }

  const configuredOrigin =
    process.env.NEXT_PUBLIC_APP_URL;

  let expectedOrigin =
    getTrustedRequestOrigin(request);

  if (configuredOrigin) {
    try {
      expectedOrigin =
        new URL(configuredOrigin).origin;
    } catch {
      return false;
    }
  }

  return origin === expectedOrigin;
}

/* =========================================================
   SECRETS
========================================================= */

function readSecret(
  name: string
): string {
  const value =
    process.env[name];

  if (
    !value ||
    value.length < 32
  ) {
    throw new Error(
      `${name}_NOT_CONFIGURED`
    );
  }

  return value;
}

/* =========================================================
   SIGNATURE HMAC
========================================================= */

function makeHmac(
  secret: string,
  parts: string[]
): string {
  const hmac =
    createHmac("sha256", secret);

  for (const part of parts) {
    hmac.update(part);
    hmac.update("\0");
  }

  return hmac.digest("hex");
}

function safeEqualHex(
  supplied: string,
  expected: string
): boolean {
  if (
    !TOKEN_PATTERN.test(supplied) ||
    !TOKEN_PATTERN.test(expected)
  ) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(supplied, "hex"),
    Buffer.from(expected, "hex")
  );
}

/* =========================================================
   AUTORISATION DU CHECKOUT
========================================================= */

/**
 * Signature identique à celle utilisée dans
 * les API publiques existantes de TIKEMIA.
 */

function createCheckoutToken(
  resource: CheckoutResource
): string {
  return makeHmac(
    readSecret("TIKEMIA_CHECKOUT_SECRET"),
    [
      CHECKOUT_CONTEXT,
      resource.type,
      resource.id,
      resource.amount.toString(),
      resource.currency,
      resource.createdAt.toISOString(),
    ]
  );
}

function verifyCheckoutToken(
  supplied: string,
  resource: CheckoutResource
): boolean {
  if (
    Date.now() >
    resource.createdAt.getTime() +
      CHECKOUT_VALIDITY_MS
  ) {
    return false;
  }

  return safeEqualHex(
    supplied,
    createCheckoutToken(resource)
  );
}

/* =========================================================
   TOKEN DE CONSULTATION DU STATUT
========================================================= */

/**
 * Compatible avec :
 * /api/checkout/payment-status
 *
 * Le token n'est pas une preuve de paiement.
 */

function createStatusToken(
  payment: PaymentRecord
): string {
  return createHmac(
    "sha256",
    readSecret("TIKEMIA_OTP_SECRET")
  )
    .update(STATUS_CONTEXT)
    .update("\0")
    .update(payment.id)
    .update("\0")
    .update(payment.reference)
    .update("\0")
    .update(payment.createdAt.toISOString())
    .digest("hex");
}

/* =========================================================
   VALIDATIONS
========================================================= */

function readLocale(
  value: unknown
): Locale {
  return value === "en"
    ? "en"
    : "fr";
}

function normalizeEmail(
  value: unknown
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const email =
    value.trim().toLowerCase();

  return (
    email.length > 0 &&
    email.length <= 254 &&
    EMAIL_PATTERN.test(email)
  )
    ? email
    : null;
}

function normalizePhone(
  value: unknown
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const phone = value.trim();

  return PHONE_PATTERN.test(phone)
    ? phone
    : null;
}

function normalizeCountry(
  value: unknown
): string | null {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z]{2}$/.test(value)
  ) {
    return null;
  }

  return value.toUpperCase();
}

function calculateFee(
  amount: bigint,
  basisPoints: bigint
): bigint {
  if (amount <= 0n) {
    throw new CheckoutError(
      "INVALID_AMOUNT"
    );
  }

  return (
    amount * basisPoints + 5000n
  ) / 10000n;
}

function newReference(): string {
  return (
    "TKP-" +
    randomBytes(16)
      .toString("hex")
      .toUpperCase()
  );
}

/* =========================================================
   VALIDATION DES PARAMÈTRES
========================================================= */

function validateBody(
  body: CheckoutBody
) {
  const type: ResourceType | null =
    body.type === "tickets" ||
    body.type === "ticket"
      ? "tickets"
      : body.type === "donation"
        ? "donation"
        : null;

  if (!type) {
    throw new CheckoutError(
      "INVALID_REQUEST"
    );
  }

  const resourceId =
    type === "tickets"
      ? body.orderId
      : body.donationId ?? body.orderId;

  if (
    typeof resourceId !== "string" ||
    !UUID_PATTERN.test(resourceId)
  ) {
    throw new CheckoutError(
      "INVALID_REQUEST"
    );
  }

  if (
    typeof body.checkoutToken !== "string" ||
    !TOKEN_PATTERN.test(body.checkoutToken)
  ) {
    throw new CheckoutError(
      "UNAUTHORIZED",
      403
    );
  }

  const methodId =
    body.paymentMethodId ??
    body.methodId;

  if (
    typeof methodId !== "string" ||
    !METHOD_PATTERN.test(methodId)
  ) {
    throw new CheckoutError(
      "METHOD_UNAVAILABLE"
    );
  }

  const countryCode =
    normalizeCountry(body.countryCode);

  if (!countryCode) {
    throw new CheckoutError(
      "INVALID_CUSTOMER"
    );
  }

  if (
    body.idempotencyKey !== undefined &&
    (
      typeof body.idempotencyKey !== "string" ||
      !IDEMPOTENCY_PATTERN.test(
        body.idempotencyKey
      )
    )
  ) {
    throw new CheckoutError(
      "INVALID_REQUEST"
    );
  }

  return {
    type,
    resourceId,
    checkoutToken: body.checkoutToken,
    methodId,
    countryCode,
  };
}

/* =========================================================
   LECTURE DE LA COMMANDE
========================================================= */

/**
 * Le serveur récupère toutes les données
 * financières depuis PostgreSQL.
 *
 * Aucun prix envoyé par le navigateur n'est utilisé.
 */

async function readResource(
  type: ResourceType,
  id: string
): Promise<CheckoutResource> {
  const prisma = getPlatformPrisma();

  if (type === "tickets") {
    const order =
      await prisma.order.findUnique({
        where: { id },

        include: {
          lines: {
            include: {
              event: {
                select: {
                  status: true,
                },
              },

              category: {
                select: {
                  isActive: true,
                },
              },
            },
          },

          reservations: true,
        },
      });

    if (
      !order ||
      order.status !== "PENDING"
    ) {
      throw new CheckoutError(
        "ORDER_STATE_CHANGED",
        409
      );
    }

    if (
      order.lines.length === 0
    ) {
      throw new CheckoutError(
        "INVALID_AMOUNT"
      );
    }

    let subtotal = 0n;
    let ticketCount = 0;

    const quantities =
      new Map<string, number>();

    for (const line of order.lines) {
      if (
        line.quantity <= 0 ||
        line.unitPrice < 0n ||
        line.subtotal !==
          line.unitPrice *
            BigInt(line.quantity) ||
        line.currency !== order.currency ||
        line.event.status !== "PUBLISHED" ||
        !line.category.isActive
      ) {
        throw new CheckoutError(
          "INVALID_AMOUNT"
        );
      }

      subtotal += line.subtotal;
      ticketCount += line.quantity;

      quantities.set(
        line.ticketCategoryId,
        (
          quantities.get(
            line.ticketCategoryId
          ) ?? 0
        ) + line.quantity
      );
    }

    if (
      subtotal !== order.subtotal ||
      ticketCount <= 0
    ) {
      throw new CheckoutError(
        "INVALID_AMOUNT"
      );
    }

    const fee =
      calculateFee(subtotal, 200n);

    if (
      order.serviceFeeBps !== 200 ||
      order.serviceFee !== fee ||
      order.total !== subtotal + fee
    ) {
      throw new CheckoutError(
        "INVALID_AMOUNT"
      );
    }

    /* ---------------------------------------
       Vérification des réservations
    --------------------------------------- */

    const now = new Date();

    const reserved =
      new Map<string, number>();

    for (
      const reservation
      of order.reservations
    ) {
      if (
        reservation.status !== "ACTIVE" ||
        reservation.expiresAt <= now ||
        reservation.quantity <= 0
      ) {
        throw new CheckoutError(
          "INVALID_RESERVATION",
          409
        );
      }

      reserved.set(
        reservation.ticketCategoryId,
        (
          reserved.get(
            reservation.ticketCategoryId
          ) ?? 0
        ) + reservation.quantity
      );
    }

    for (
      const [categoryId, quantity]
      of quantities
    ) {
      if (
        reserved.get(categoryId) !==
        quantity
      ) {
        throw new CheckoutError(
          "INVALID_RESERVATION",
          409
        );
      }
    }

    if (
      reserved.size !== quantities.size
    ) {
      throw new CheckoutError(
        "INVALID_RESERVATION",
        409
      );
    }

    const email = normalizeEmail(
      order.guestEmail
    );

    const phone = normalizePhone(
      order.guestPhoneE164
    );

    if (!email || !phone) {
      throw new CheckoutError(
        "INVALID_CUSTOMER"
      );
    }

    return {
      type,
      id: order.id,
      createdAt: order.createdAt,
      amount: order.total,
      currency: order.currency,
      email,
      phone,
      description:
        `TIKEMIA - ${ticketCount} billet(s) - ${order.reference}`.slice(
          0,
          255
        ),
    };
  }

  /* =====================================================
     DONATION
  ===================================================== */

  const donation =
    await prisma.donation.findUnique({
      where: { id },

      include: {
        campaign: {
          select: {
            status: true,
            closedAt: true,
          },
        },
      },
    });

  if (
    !donation ||
    donation.status !== "PENDING"
  ) {
    throw new CheckoutError(
      "ORDER_STATE_CHANGED",
      409
    );
  }

  if (
    donation.campaign.status !== "PUBLISHED" ||
    (
      donation.campaign.closedAt &&
      donation.campaign.closedAt <= new Date()
    )
  ) {
    throw new CheckoutError(
      "ORDER_STATE_CHANGED",
      409
    );
  }

  if (donation.amount <= 0n) {
    throw new CheckoutError(
      "INVALID_AMOUNT"
    );
  }

  const email = normalizeEmail(
    donation.donorEmail
  );

  const phone = normalizePhone(
    donation.donorPhoneE164
  );

  if (!email || !phone) {
    throw new CheckoutError(
      "INVALID_CUSTOMER"
    );
  }

  const fee =
    calculateFee(donation.amount, 100n);

  return {
    type,
    id: donation.id,
    createdAt: donation.createdAt,
    amount: donation.amount + fee,
    currency: donation.currency,
    email,
    phone,
    description:
      `TIKEMIA - Don - ${donation.reference}`.slice(
        0,
        255
      ),
  };
}

/* =========================================================
   CONVERSION MONÉTAIRE
========================================================= */

/**
 * Les valeurs Prisma sont en unités mineures.
 *
 * Le connecteur FedaPay exige un PaymentMoney.
 *
 * La conversion en montant majeur est effectuée
 * ensuite par fedapay.ts, sans arrondi silencieux.
 */

function toPaymentMoney(
  amount: bigint,
  currency: string
): PaymentMoney {
  if (!isSupportedCurrency(currency)) throw new CheckoutError("PAYMENT_UNAVAILABLE", 503);
  const exponent = currencyDecimals(currency);
  if (
    amount <= 0n ||
    amount >
      BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    throw new CheckoutError(
      "INVALID_AMOUNT"
    );
  }

  return {
    currency,
    amountMinor: amount.toString(),
    exponent,
  };
}

/* =========================================================
   VERROUILLAGE ET CRÉATION DU PAIEMENT
========================================================= */

/**
 * Une seule transaction active est autorisée
 * par commande ou donation.
 *
 * Le verrou SQL évite deux créations simultanées.
 *
 * Une transaction INITIATED reste protégée
 * en cas de réponse inconnue du prestataire.
 *
 * Ne jamais relancer automatiquement un débit.
 */

async function reservePayment(
  resource: CheckoutResource,
  methodId: string,
  provider: string
): Promise<{
  payment: PaymentRecord;
  created: boolean;
}> {
  const prisma = getPlatformPrisma();

  return prisma.$transaction(
    async (tx) => {
      if (resource.type === "tickets") {
        await tx.$queryRaw`
          SELECT "id"
          FROM "Order"
          WHERE "id" = ${resource.id}::uuid
          FOR UPDATE
        `;
      } else {
        await tx.$queryRaw`
          SELECT "id"
          FROM "Donation"
          WHERE "id" = ${resource.id}::uuid
          FOR UPDATE
        `;
      }

      const existing =
        await tx.payment.findFirst({
          where:
            resource.type === "tickets"
              ? {
                  orderId: resource.id,
                  status: {
                    in: [
                      "INITIATED",
                      "PENDING",
                      "SUCCEEDED",
                    ],
                  },
                }
              : {
                  donationId: resource.id,
                  status: {
                    in: [
                      "INITIATED",
                      "PENDING",
                      "SUCCEEDED",
                    ],
                  },
                },

          orderBy: {
            createdAt: "desc",
          },

          select: {
            id: true,
            reference: true,
            status: true,
            providerRef: true,
            provider: true,
            createdAt: true,
          },
        });

      if (existing) {
        return {
          payment: existing,
          created: false,
        };
      }

      /* ---------------------------------------
         Recontrôle de l'état financier
      --------------------------------------- */

      if (resource.type === "tickets") {
        const order =
          await tx.order.findUnique({
            where: {
              id: resource.id,
            },
            select: {
              status: true,
              total: true,
              currency: true,
            },
          });

        if (
          !order ||
          order.status !== "PENDING" ||
          order.total !== resource.amount ||
          order.currency !== resource.currency
        ) {
          throw new CheckoutError(
            "ORDER_STATE_CHANGED",
            409
          );
        }

        const reservations =
          await tx.inventoryReservation.findMany({
            where: {
              orderId: resource.id,
            },
          });

        if (
          reservations.length === 0 ||
          reservations.some(
            (reservation) =>
              reservation.status !== "ACTIVE" ||
              reservation.expiresAt <=
                new Date()
          )
        ) {
          throw new CheckoutError(
            "INVALID_RESERVATION",
            409
          );
        }
      } else {
        const donation =
          await tx.donation.findUnique({
            where: {
              id: resource.id,
            },

            select: {
              status: true,
              amount: true,
              currency: true,
            },
          });

        if (
          !donation ||
          donation.status !== "PENDING" ||
          donation.currency !== resource.currency ||
          donation.amount +
            calculateFee(
              donation.amount,
              100n
            ) !== resource.amount
        ) {
          throw new CheckoutError(
            "ORDER_STATE_CHANGED",
            409
          );
        }
      }

      const created =
        await tx.payment.create({
          data: {
            reference: newReference(),

            purpose:
              resource.type === "tickets"
                ? "TICKET_ORDER"
                : "DONATION",

            orderId:
              resource.type === "tickets"
                ? resource.id
                : null,

            donationId:
              resource.type === "donation"
                ? resource.id
                : null,

            provider,

            method: methodId,

            amount: resource.amount,
            currency: resource.currency,

            status: "INITIATED",
          },

          select: {
            id: true,
            reference: true,
            status: true,
            providerRef: true,
            provider: true,
            createdAt: true,
          },
        });

      return {
        payment: created,
        created: true,
      };
    },
    {
      isolationLevel: "Serializable",
      maxWait: 5000,
      timeout: 15000,
    }
  );
}

/* =========================================================
   RÉPONSE D'UN PAIEMENT EXISTANT
========================================================= */

async function existingPaymentResponse(
  resource: CheckoutResource,
  payment: PaymentRecord,
  locale: Locale
) {
  const statusToken =
    createStatusToken(payment);

  return json({
    success: true,

    paymentId: payment.id,

    orderId: resource.id,

    statusToken,

    status:
      payment.status === "SUCCEEDED"
        ? "processing"
        : "pending",

    nextAction: payment.providerRef && ["INITIATED", "PENDING"].includes(payment.status)
      ? await getProviderConnector(payment.provider)?.checkout?.resume?.(payment.id, payment.providerRef).catch(() => ({ type: "none" as const })) ?? { type: "none" }
      : { type: "none" },

    statusUrl:
      "/api/checkout/payment-status",

    nextPollSeconds: 3,

    message:
      payment.status === "SUCCEEDED"
        ? locale === "fr"
          ? "Paiement confirmé. Traitement en cours."
          : "Payment confirmed. Processing."
        : locale === "fr"
          ? "Paiement en cours de vérification."
          : "Payment verification in progress.",
  });
}

/* =========================================================
   POST /api/checkout/pay
========================================================= */

export async function POST(
  request: NextRequest
) {
  let locale: Locale = "fr";

  try {
    /* =====================================================
       SÉCURITÉ DE LA REQUÊTE
    ===================================================== */

    if (!validOrigin(request)) {
      return errorResponse(
        locale,
        "UNAUTHORIZED",
        403
      );
    }

    const contentType =
      request.headers.get(
        "content-type"
      ) ?? "";

    if (
      !contentType
        .toLowerCase()
        .startsWith(
          "application/json"
        )
    ) {
      return errorResponse(
        locale,
        "INVALID_REQUEST",
        415
      );
    }

    const declaredLength =
      request.headers.get(
        "content-length"
      );

    if (
      declaredLength &&
      Number(declaredLength) >
        MAX_BODY_BYTES
    ) {
      return errorResponse(
        locale,
        "INVALID_REQUEST",
        413
      );
    }

    const rawBody =
      await request.text();

    if (
      Buffer.byteLength(
        rawBody,
        "utf8"
      ) > MAX_BODY_BYTES
    ) {
      return errorResponse(
        locale,
        "INVALID_REQUEST",
        413
      );
    }

    let parsed: unknown;

    try {
      parsed =
        JSON.parse(rawBody);
    } catch {
      return errorResponse(
        locale,
        "INVALID_REQUEST",
        400
      );
    }

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return errorResponse(
        locale,
        "INVALID_REQUEST",
        400
      );
    }

    const body =
      parsed as CheckoutBody;

    locale = readLocale(
      body.locale
    );

    /* =====================================================
       VALIDATION DES DONNÉES
    ===================================================== */

    const input =
      validateBody(body);

    /* =====================================================
       CONFIGURATION SERVEUR
    ===================================================== */

    readSecret(
      "TIKEMIA_CHECKOUT_SECRET"
    );

    readSecret(
      "TIKEMIA_OTP_SECRET"
    );

    /* =====================================================
       LECTURE DE LA COMMANDE
    ===================================================== */

    const resource =
      await readResource(
        input.type,
        input.resourceId
      );

    /* =====================================================
       VÉRIFICATION DU CHECKOUT TOKEN
    ===================================================== */

    if (
      Date.now() >
      resource.createdAt.getTime() +
        CHECKOUT_VALIDITY_MS
    ) {
      return errorResponse(
        locale,
        "CHECKOUT_EXPIRED",
        410
      );
    }

    if (
      !verifyCheckoutToken(
        input.checkoutToken,
        resource
      )
    ) {
      return errorResponse(
        locale,
        "UNAUTHORIZED",
        403
      );
    }

    /* =====================================================
       COORDONNÉES DU CLIENT
    ===================================================== */

    if (
      body.customer !== undefined
    ) {
      if (
        !body.customer ||
        typeof body.customer !== "object" ||
        Array.isArray(body.customer)
      ) {
        return errorResponse(
          locale,
          "INVALID_CUSTOMER",
          400
        );
      }

      const customer =
        body.customer as CustomerInput;

      const suppliedEmail =
        normalizeEmail(
          customer.email
        );

      const suppliedPhone =
        normalizePhone(
          customer.phone
        );

      const suppliedCountry =
        normalizeCountry(
          customer.countryCode
        );

      if (
        suppliedEmail !==
          resource.email ||
        suppliedPhone !==
          resource.phone ||
        suppliedCountry !==
          input.countryCode
      ) {
        return errorResponse(
          locale,
          "INVALID_CUSTOMER",
          400
        );
      }
    }

    /* =====================================================
       VÉRIFICATION DE LA MÉTHODE
    ===================================================== */

    const selection =
      await resolvePaymentSelection(
        input.methodId,
        {
          countryCode:
            input.countryCode,

          currencyCode:
            resource.currency,

          checkoutType:
            resource.type === "tickets"
              ? "ticket"
              : "donation",

          amountMinor:
            resource.amount.toString(),
        }
      );

    const executor = selection ? getProviderConnector(selection.route.provider)?.checkout : null;
    if (!selection || !executor) {
      return errorResponse(
        locale,
        "METHOD_UNAVAILABLE",
        422
      );
    }

    const methodCode =
      selection.method.code;

    if (
      !executor.supportsMethod(methodCode)
    ) {
      return errorResponse(
        locale,
        "METHOD_UNAVAILABLE",
        422
      );
    }

    /* =====================================================
       PRÉVALIDATION DU MONTANT
    ===================================================== */

    toPaymentMoney(
      resource.amount,
      resource.currency
    );

    /* =====================================================
       CRÉATION ATOMIQUE DU PAIEMENT
    ===================================================== */

    const reservation =
      await reservePayment(
        resource,
        selection.method.id,
        selection.route.provider
      );

    const payment =
      reservation.payment;

    const statusToken =
      createStatusToken(
        payment
      );

    /* =====================================================
       PAIEMENT DÉJÀ EXISTANT
    ===================================================== */

    if (!reservation.created) {
      return existingPaymentResponse(
        resource,
        payment,
        locale
      );
    }

    /* =====================================================
       INITIALISATION DU PRESTATAIRE
    ===================================================== */

    if (selection.route.connectionId) {
      await getPlatformPrisma().payPaymentAttempt.create({ data: {
        paymentId: payment.id, connectionId: selection.route.connectionId, methodId: selection.route.methodId,
        idempotencyKey: payment.reference, amount: resource.amount, currency: resource.currency,
      } });
    }

    let nextAction:
      PaymentNextAction;

    try {
      nextAction =
        await executor.initiate(selection.route.connectionId, {
          paymentId: payment.id, orderId: resource.id, idempotencyKey: payment.reference,
          description: resource.description, amount: toPaymentMoney(resource.amount, resource.currency),
          paymentMethodCode: methodCode, customer: { email: resource.email, phone: resource.phone, countryCode: input.countryCode }, metadata: {},
        }, async (providerRef) => {
          const saved = await getPlatformPrisma().payment.updateMany({ where: { id: payment.id, status: "INITIATED", provider: selection.route.provider }, data: { providerRef } });
          if (saved.count !== 1) throw new Error("PAYMENT_STATE_CONFLICT");
        });
      await getPlatformPrisma().payment.updateMany({ where: { id: payment.id, status: "INITIATED" }, data: { status: "PENDING" } });
    } catch (providerError) {
      console.error(
        "[TIKEMIA_PAYMENT_INITIATION]",
        providerError instanceof Error
          ? providerError.name
          : "UNKNOWN_ERROR"
      );

      /**
       * Ne jamais marquer automatiquement FAILED
       * après un timeout ou une réponse inconnue.
       *
       * La transaction peut avoir été créée.
       * Le rapprochement serveur doit établir
       * son véritable statut avant toute reprise.
       */

      return errorResponse(
        locale,
        "PAYMENT_INITIATION_UNKNOWN",
        503,
        {
          paymentId:
            payment.id,

          statusToken,

          status: "pending",

          statusUrl:
            "/api/checkout/payment-status",
        }
      );
    }

    /* =====================================================
       RÉPONSE AU CLIENT
    ===================================================== */

    return json({
      success: true,

      paymentId:
        payment.id,

      orderId:
        resource.id,

      statusToken,

      status: "pending",

      amountMinor:
        resource.amount.toString(),

      currency:
        resource.currency,

      nextAction,

      statusUrl:
        "/api/checkout/payment-status",

      nextPollSeconds: 3,

      message:
        locale === "fr"
          ? "Paiement en cours de confirmation."
          : "Payment confirmation in progress.",
    });
  } catch (error) {
    if (
      error instanceof CheckoutError
    ) {
      return errorResponse(
        locale,
        error.code,
        error.statusCode
      );
    }

    console.error(
      "[TIKEMIA_CHECKOUT_PAY]",
      error instanceof Error
        ? error.name
        : "UNKNOWN_ERROR"
    );

    return errorResponse(
      locale,
      "PAYMENT_UNAVAILABLE",
      503
    );
  }
}

/* =========================================================
   MÉTHODES HTTP NON AUTORISÉES
========================================================= */

function methodNotAllowed() {
  return new NextResponse(null, {
    status: 405,

    headers: {
      ...RESPONSE_HEADERS,
      Allow: "POST",
    },
  });
}

export async function GET() {
  return methodNotAllowed();
}

export async function PUT() {
  return methodNotAllowed();
}

export async function PATCH() {
  return methodNotAllowed();
}

export async function DELETE() {
  return methodNotAllowed();
}
