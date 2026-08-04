import {
  createHash,
  timingSafeEqual,
} from "node:crypto";

import {
  PaymentStatus,
  UserRole,
} from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  completeSuccessfulPayment,
} from "@/lib/payments/complete-successful-payment";
import {
  PaymentError,
  PaymentValidationError,
  getPaymentError,
  getPaymentErrorLogContext,
} from "@/lib/payments/payment-errors";
import {
  verifyMonerooPayment,
} from "@/lib/payments/verify-moneroo-payment";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_CLIENT_SESSION_COOKIE_NAME =
  "tikemia_client_session";

const LEGACY_SESSION_COOKIE_NAME =
  "tikemia_session";

const verifyPaymentSchema = z
  .object({
    paymentId: z
      .string()
      .trim()
      .min(
        1,
        "L’identifiant du paiement est obligatoire.",
      )
      .max(
        100,
        "L’identifiant du paiement est invalide.",
      )
      .optional(),

    orderId: z
      .string()
      .trim()
      .min(
        1,
        "L’identifiant de la commande est obligatoire.",
      )
      .max(
        100,
        "L’identifiant de la commande est invalide.",
      )
      .optional(),

    checkoutToken: z
      .string()
      .trim()
      .min(
        32,
        "Le jeton de checkout est invalide.",
      )
      .max(
        500,
        "Le jeton de checkout est trop long.",
      )
      .optional(),
  })
  .strict()
  .refine(
    (value) =>
      Boolean(value.paymentId || value.orderId),
    {
      message:
        "L’identifiant du paiement ou de la commande est obligatoire.",
      path: ["paymentId"],
    },
  );

type AuthenticatedCustomer = {
  id: string;
  email: string;
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function normalizeText(
  value: string | null | undefined,
): string {
  return value?.trim() ?? "";
}

function hashToken(token: string): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

function secureHashEquals(
  left: string,
  right: string,
): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  if (
    leftBuffer.length !== rightBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    leftBuffer,
    rightBuffer,
  );
}

function getSessionCookieNames(): string[] {
  return Array.from(
    new Set(
      [
        normalizeText(
          process.env.CLIENT_SESSION_COOKIE_NAME,
        ),
        normalizeText(
          process.env.SESSION_COOKIE_NAME,
        ),
        DEFAULT_CLIENT_SESSION_COOKIE_NAME,
        LEGACY_SESSION_COOKIE_NAME,
      ].filter(Boolean),
    ),
  );
}

async function getAuthenticatedCustomer(): Promise<
  AuthenticatedCustomer | null
> {
  const cookieStore = await cookies();

  let sessionToken = "";

  for (
    const cookieName of getSessionCookieNames()
  ) {
    sessionToken = normalizeText(
      cookieStore.get(cookieName)?.value,
    );

    if (sessionToken) {
      break;
    }
  }

  if (!sessionToken) {
    return null;
  }

  const session =
    await prisma.session.findUnique({
      where: {
        tokenHash: hashToken(sessionToken),
      },
      select: {
        id: true,
        expiresAt: true,
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            emailVerified: true,
            isActive: true,
          },
        },
      },
    });

  if (!session) {
    return null;
  }

  if (
    session.expiresAt.getTime() <=
    Date.now()
  ) {
    await prisma.session
      .delete({
        where: {
          id: session.id,
        },
      })
      .catch(() => undefined);

    return null;
  }

  if (
    session.user.role !==
      UserRole.CUSTOMER ||
    !session.user.emailVerified ||
    !session.user.isActive
  ) {
    return null;
  }

  return {
    id: session.user.id,
    email: normalizeText(
      session.user.email,
    ).toLowerCase(),
  };
}

function assertPaymentOwnership({
  customer,
  checkoutToken,
  paymentId,
  order,
}: {
  customer: AuthenticatedCustomer | null;
  checkoutToken: string;
  paymentId: string;
  order: {
    id: string;
    customerId: string | null;
    checkoutTokenHash: string | null;
  };
}): void {
  if (customer) {
    if (
      order.customerId !== customer.id
    ) {
      throw new PaymentValidationError({
        code:
          "PAYMENT_ORDER_OWNERSHIP_MISMATCH",
        message:
          "Ce paiement n’appartient pas à votre compte.",
        status: 403,
        paymentId,
        orderId: order.id,
      });
    }

    return;
  }

  if (order.customerId) {
    throw new PaymentValidationError({
      code: "PAYMENT_UNAUTHORIZED",
      message:
        "Connectez-vous pour vérifier ce paiement.",
      status: 401,
      paymentId,
      orderId: order.id,
    });
  }

  if (
    !checkoutToken ||
    !order.checkoutTokenHash
  ) {
    throw new PaymentValidationError({
      code: "PAYMENT_UNAUTHORIZED",
      message:
        "Le jeton sécurisé de la commande est obligatoire.",
      status: 401,
      paymentId,
      orderId: order.id,
    });
  }

  const suppliedTokenHash =
    hashToken(checkoutToken);

  if (
    !secureHashEquals(
      suppliedTokenHash,
      order.checkoutTokenHash,
    )
  ) {
    throw new PaymentValidationError({
      code: "PAYMENT_FORBIDDEN",
      message:
        "Le jeton sécurisé de cette commande est invalide.",
      status: 403,
      paymentId,
      orderId: order.id,
    });
  }
}

export async function POST(request: Request) {
  let paymentId: string | null = null;
  let orderId: string | null = null;

  try {
    let rawBody: unknown;

    try {
      rawBody = await request.json();
    } catch {
      return jsonResponse(
        {
          success: false,
          error: {
            code:
              "PAYMENT_INVALID_REQUEST",
            message:
              "La requête envoyée est invalide.",
          },
        },
        400,
      );
    }

    const parsedBody =
      verifyPaymentSchema.safeParse(
        rawBody,
      );

    if (!parsedBody.success) {
      return jsonResponse(
        {
          success: false,
          error: {
            code:
              "PAYMENT_INVALID_REQUEST",
            message:
              parsedBody.error
                .issues[0]?.message ??
              "Les informations du paiement sont invalides.",
            field:
              parsedBody.error
                .issues[0]?.path.join(
                  ".",
                ) ?? null,
          },
        },
        400,
      );
    }

    const input = parsedBody.data;

    paymentId =
      normalizeText(input.paymentId) ||
      null;

    orderId =
      normalizeText(input.orderId) ||
      null;

    const [customer, payment] =
      await Promise.all([
        getAuthenticatedCustomer(),

        prisma.payment.findFirst({
          where: paymentId
            ? {
                id: paymentId,
              }
            : {
                orderId:
                  orderId as string,
              },
          select: {
            id: true,
            orderId: true,
            provider: true,
            providerTransactionId:
              true,
            providerReference: true,
            status: true,
            order: {
              select: {
                id: true,
                reference: true,
                customerId: true,
                checkoutTokenHash:
                  true,
                status: true,
                ticketsIssuedAt:
                  true,
              },
            },
          },
        }),
      ]);

    if (!payment) {
      throw new PaymentError({
        code:
          "PAYMENT_PROVIDER_TRANSACTION_NOT_FOUND",
        message:
          "Le paiement est introuvable.",
        status: 404,
        retryable: false,
        exposeMessage: true,
        paymentId:
          paymentId ?? undefined,
        orderId:
          orderId ?? undefined,
      });
    }

    paymentId = payment.id;
    orderId = payment.orderId;

    assertPaymentOwnership({
      customer,
      checkoutToken:
        normalizeText(
          input.checkoutToken,
        ),
      paymentId: payment.id,
      order: payment.order,
    });

    if (
      payment.status ===
        PaymentStatus.SUCCESS &&
      payment.order.status === "PAID" &&
      payment.order.ticketsIssuedAt
    ) {
      return jsonResponse({
        success: true,
        code:
          "PAYMENT_ALREADY_SUCCESSFUL",
        message:
          "Le paiement est déjà confirmé.",
        payment: {
          id: payment.id,
          orderId:
            payment.orderId,
          orderReference:
            payment.order.reference,
          provider:
            payment.provider,
          status:
            payment.status,
        },
        completed: true,
      });
    }

    if (payment.provider !== "MONEROO") {
      throw new PaymentError({
        code:
          "PAYMENT_PROVIDER_RESPONSE_INVALID",
        message:
          "Cette route de vérification est réservée aux paiements Moneroo.",
        status: 409,
        retryable: false,
        exposeMessage: true,
        provider:
          payment.provider,
        paymentId:
          payment.id,
        orderId:
          payment.orderId,
      });
    }

    if (
      !payment.providerTransactionId
    ) {
      throw new PaymentError({
        code:
          "PAYMENT_PROVIDER_TRANSACTION_NOT_FOUND",
        message:
          "L’identifiant de transaction Moneroo est absent.",
        status: 409,
        retryable: true,
        exposeMessage: true,
        provider:
          payment.provider,
        paymentId:
          payment.id,
        orderId:
          payment.orderId,
      });
    }

    const verified =
      await verifyMonerooPayment({
        paymentId: payment.id,
        providerTransactionId:
          payment.providerTransactionId,
        signal: request.signal,
      });

    let completion:
      | Awaited<
          ReturnType<
            typeof completeSuccessfulPayment
          >
        >
      | null = null;

    if (
      verified.status ===
      PaymentStatus.SUCCESS
    ) {
      completion =
        await completeSuccessfulPayment({
          paymentId:
            verified.paymentId,
          providerTransactionId:
            verified.providerTransactionId,
          providerReference:
            verified.providerReference,
          gateway:
            verified.gateway,
          paymentMethod:
            verified.paymentMethod,
          paidAt:
            verified.verifiedAt,
        });
    }

    return jsonResponse({
      success: true,
      message:
        verified.status ===
        PaymentStatus.SUCCESS
          ? "Le paiement a été confirmé."
          : "Le statut du paiement a été vérifié.",
      payment: {
        id: verified.paymentId,
        orderId:
          verified.orderId,
        provider:
          verified.provider,
        providerTransactionId:
          verified.providerTransactionId,
        providerReference:
          verified.providerReference,
        status:
          verified.status,
        rawStatus:
          verified.rawStatus,
        gateway:
          verified.gateway,
        paymentMethod:
          verified.paymentMethod,
        amount:
          verified.amount.toFixed(2),
        currency:
          verified.currency,
        terminal:
          verified.isFinal,
        verifiedAt:
          verified.verifiedAt.toISOString(),
      },
      completion,
    });
  } catch (error) {
    const paymentError =
      getPaymentError(error, {
        code:
          "PAYMENT_INTERNAL_ERROR",
        message:
          "Impossible de vérifier le paiement pour le moment.",
        status: 500,
        exposeMessage: false,
        paymentId,
        orderId,
      });

    console.error(
      "[CLIENT_PAYMENT_VERIFY_ERROR]",
      getPaymentErrorLogContext(
        paymentError,
      ),
    );

    return jsonResponse(
      paymentError.toJSON() as unknown as Record<
        string,
        unknown
      >,
      paymentError.status,
    );
  }
}
