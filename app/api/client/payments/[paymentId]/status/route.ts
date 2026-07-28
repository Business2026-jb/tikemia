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
  PaymentValidationError,
  getPaymentError,
  getPaymentErrorLogContext,
} from "@/lib/payments/payment-errors";
import { prisma } from "@/lib/prisma";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

const DEFAULT_CLIENT_SESSION_COOKIE_NAME =
  "tikemia_client_session";

const LEGACY_SESSION_COOKIE_NAME =
  "tikemia_session";

const paymentIdSchema =
  z
    .string()
    .trim()
    .min(
      1,
      "L’identifiant du paiement est obligatoire.",
    )
    .max(
      100,
      "L’identifiant du paiement est invalide.",
    );

type PaymentStatusRouteProps = {
  params: Promise<{
    paymentId: string;
  }>;
};

type AuthenticatedCustomer = {
  id: string;
  email: string;
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(
    body,
    {
      status,

      headers: {
        "Cache-Control":
          "no-store, max-age=0",

        Pragma:
          "no-cache",

        "X-Content-Type-Options":
          "nosniff",
      },
    },
  );
}

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string {
  return value?.trim() ?? "";
}

function hashToken(
  token: string,
): string {
  return createHash(
    "sha256",
  )
    .update(
      token,
    )
    .digest(
      "hex",
    );
}

function secureHashEquals(
  left: string,
  right: string,
): boolean {
  const leftBuffer =
    Buffer.from(
      left,
      "utf8",
    );

  const rightBuffer =
    Buffer.from(
      right,
      "utf8",
    );

  if (
    leftBuffer.length !==
    rightBuffer.length
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
          process.env
            .CLIENT_SESSION_COOKIE_NAME,
        ),

        normalizeText(
          process.env
            .SESSION_COOKIE_NAME,
        ),

        DEFAULT_CLIENT_SESSION_COOKIE_NAME,

        LEGACY_SESSION_COOKIE_NAME,
      ].filter(
        Boolean,
      ),
    ),
  );
}

async function getAuthenticatedCustomer(): Promise<
  AuthenticatedCustomer | null
> {
  const cookieStore =
    await cookies();

  let sessionToken =
    "";

  for (
    const cookieName of
    getSessionCookieNames()
  ) {
    sessionToken =
      normalizeText(
        cookieStore.get(
          cookieName,
        )?.value,
      );

    if (
      sessionToken
    ) {
      break;
    }
  }

  if (
    !sessionToken
  ) {
    return null;
  }

  const session =
    await prisma.session.findUnique({
      where: {
        tokenHash:
          hashToken(
            sessionToken,
          ),
      },

      select: {
        id:
          true,

        expiresAt:
          true,

        user: {
          select: {
            id:
              true,

            email:
              true,

            role:
              true,

            emailVerified:
              true,

            isActive:
              true,
          },
        },
      },
    });

  if (
    !session
  ) {
    return null;
  }

  if (
    session.expiresAt.getTime() <=
    Date.now()
  ) {
    await prisma.session
      .delete({
        where: {
          id:
            session.id,
        },
      })
      .catch(
        () =>
          undefined,
      );

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
    id:
      session.user.id,

    email:
      normalizeText(
        session.user.email,
      ).toLowerCase(),
  };
}

function getCheckoutToken(
  request: Request,
): string {
  const url =
    new URL(
      request.url,
    );

  return (
    normalizeText(
      request.headers.get(
        "x-checkout-token",
      ),
    ) ||
    normalizeText(
      url.searchParams.get(
        "checkoutToken",
      ),
    )
  );
}

function assertPaymentOwnership({
  customer,
  checkoutToken,
  order,
  paymentId,
}: {
  customer:
    AuthenticatedCustomer | null;
  checkoutToken:
    string;
  order: {
    id: string;
    customerId: string | null;
    customerEmail: string;
    checkoutTokenHash: string | null;
  };
  paymentId:
    string;
}): void {
  if (
    customer
  ) {
    if (
      order.customerId !==
      customer.id
    ) {
      throw new PaymentValidationError({
        code:
          "PAYMENT_ORDER_OWNERSHIP_MISMATCH",

        message:
          "Ce paiement n’appartient pas à votre compte.",

        status:
          403,

        paymentId,

        orderId:
          order.id,
      });
    }

    return;
  }

  if (
    order.customerId
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_UNAUTHORIZED",

      message:
        "Connectez-vous pour consulter ce paiement.",

      status:
        401,

      paymentId,

      orderId:
        order.id,
    });
  }

  if (
    !checkoutToken ||
    !order.checkoutTokenHash
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_UNAUTHORIZED",

      message:
        "Le jeton sécurisé de la commande est obligatoire.",

      status:
        401,

      paymentId,

      orderId:
        order.id,
    });
  }

  const suppliedTokenHash =
    hashToken(
      checkoutToken,
    );

  if (
    !secureHashEquals(
      suppliedTokenHash,
      order.checkoutTokenHash,
    )
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_FORBIDDEN",

      message:
        "Le jeton sécurisé de la commande est invalide.",

      status:
        403,

      paymentId,

      orderId:
        order.id,
    });
  }
}

function getRedirectTo({
  paymentStatus,
  orderStatus,
  ticketsReady,
  orderId,
}: {
  paymentStatus: string;
  orderStatus: string;
  ticketsReady: boolean;
  orderId: string;
}): string | null {
  if (
    ticketsReady
  ) {
    return "/account/tickets";
  }

  if (
    paymentStatus ===
      "FAILED" ||
    orderStatus ===
      "FAILED"
  ) {
    return `/payment/failed?orderId=${encodeURIComponent(
      orderId,
    )}`;
  }

  if (
    paymentStatus ===
      "CANCELLED" ||
    orderStatus ===
      "CANCELLED"
  ) {
    return `/payment/cancelled?orderId=${encodeURIComponent(
      orderId,
    )}`;
  }

  if (
    paymentStatus ===
      "EXPIRED" ||
    orderStatus ===
      "EXPIRED"
  ) {
    return `/payment/failed?reason=expired&orderId=${encodeURIComponent(
      orderId,
    )}`;
  }

  return null;
}

function isTerminalPaymentStatus(
  status: PaymentStatus,
): boolean {
  return (
    status ===
      PaymentStatus.SUCCESS ||
    status ===
      PaymentStatus.FAILED ||
    status ===
      PaymentStatus.CANCELLED ||
    status ===
      PaymentStatus.EXPIRED ||
    status ===
      PaymentStatus.REFUNDED ||
    status ===
      PaymentStatus.PARTIALLY_REFUNDED ||
    status ===
      PaymentStatus.DISPUTED
  );
}

export async function GET(
  request: Request,
  {
    params,
  }: PaymentStatusRouteProps,
) {
  try {
    const {
      paymentId: rawPaymentId,
    } =
      await params;

    const paymentIdValidation =
      paymentIdSchema.safeParse(
        rawPaymentId,
      );

    if (
      !paymentIdValidation.success
    ) {
      return jsonResponse(
        {
          success:
            false,

          error: {
            code:
              "PAYMENT_INVALID_REQUEST",

            message:
              paymentIdValidation
                .error
                .issues[0]
                ?.message ??
              "L’identifiant du paiement est invalide.",
          },
        },
        400,
      );
    }

    const paymentId =
      paymentIdValidation.data;

    const [
      customer,
      payment,
    ] =
      await Promise.all([
        getAuthenticatedCustomer(),

        prisma.payment.findUnique({
          where: {
            id:
              paymentId,
          },

          select: {
            id:
              true,

            provider:
              true,

            providerReference:
              true,

            providerTransactionId:
              true,

            method:
              true,

            status:
              true,

            amount:
              true,

            currency:
              true,

            checkoutUrl:
              true,

            expiresAt:
              true,

            initiatedAt:
              true,

            processingAt:
              true,

            paidAt:
              true,

            failedAt:
              true,

            cancelledAt:
              true,

            refundedAt:
              true,

            createdAt:
              true,

            updatedAt:
              true,

            order: {
              select: {
                id:
                  true,

                reference:
                  true,

                customerId:
                  true,

                customerEmail:
                  true,

                checkoutTokenHash:
                  true,

                status:
                  true,

                reservationExpiresAt:
                  true,

                paymentConfirmedAt:
                  true,

                finalizedAt:
                  true,

                ticketsIssuedAt:
                  true,

                paidAt:
                  true,

                event: {
                  select: {
                    id:
                      true,

                    slug:
                      true,

                    title:
                      true,
                  },
                },

                items: {
                  select: {
                    quantity:
                      true,

                    tickets: {
                      select: {
                        id:
                          true,

                        status:
                          true,
                      },
                    },
                  },
                },
              },
            },
          },
        }),
      ]);

    if (
  !payment
) {
  throw new PaymentValidationError({
    code:
      "PAYMENT_ORDER_NOT_FOUND",

    message:
      "Le paiement est introuvable.",

    status:
      404,

    paymentId,
  });
}

    const checkoutToken =
      getCheckoutToken(
        request,
      );

    assertPaymentOwnership({
      customer,
      checkoutToken,
      order:
        payment.order,
      paymentId:
        payment.id,
    });

    const expectedTicketsCount =
      payment.order.items.reduce(
        (
          total,
          item,
        ) =>
          total +
          item.quantity,
        0,
      );

    const issuedTicketsCount =
      payment.order.items.reduce(
        (
          total,
          item,
        ) =>
          total +
          item.tickets.length,
        0,
      );

    const validTicketsCount =
      payment.order.items.reduce(
        (
          total,
          item,
        ) =>
          total +
          item.tickets.filter(
            (
              ticket,
            ) =>
              ticket.status ===
              "VALID",
          ).length,
        0,
      );

    const ticketsReady =
      payment.status ===
        PaymentStatus.SUCCESS &&
      payment.order.status ===
        "PAID" &&
      Boolean(
        payment.order
          .ticketsIssuedAt,
      ) &&
      expectedTicketsCount >
        0 &&
      issuedTicketsCount ===
        expectedTicketsCount;

    const redirectTo =
      getRedirectTo({
        paymentStatus:
          payment.status,

        orderStatus:
          payment.order.status,

        ticketsReady,

        orderId:
          payment.order.id,
      });

    return jsonResponse({
      success:
        true,

      payment: {
        id:
          payment.id,

        provider:
          payment.provider,

        providerReference:
          payment.providerReference,

        providerTransactionId:
          payment.providerTransactionId,

        method:
          payment.method,

        status:
          payment.status,

        amount:
          payment.amount.toFixed(
            2,
          ),

        currency:
          payment.currency,

        checkoutUrl:
          payment.status ===
            PaymentStatus.PENDING ||
          payment.status ===
            PaymentStatus.PROCESSING
            ? payment.checkoutUrl
            : null,

        expiresAt:
          payment.expiresAt
            ?.toISOString() ??
          null,

        initiatedAt:
          payment.initiatedAt.toISOString(),

        processingAt:
          payment.processingAt
            ?.toISOString() ??
          null,

        paidAt:
          payment.paidAt
            ?.toISOString() ??
          null,

        failedAt:
          payment.failedAt
            ?.toISOString() ??
          null,

        cancelledAt:
          payment.cancelledAt
            ?.toISOString() ??
          null,

        refundedAt:
          payment.refundedAt
            ?.toISOString() ??
          null,

        updatedAt:
          payment.updatedAt.toISOString(),

        terminal:
          isTerminalPaymentStatus(
            payment.status,
          ),
      },

      order: {
        id:
          payment.order.id,

        reference:
          payment.order.reference,

        status:
          payment.order.status,

        reservationExpiresAt:
          payment.order
            .reservationExpiresAt
            ?.toISOString() ??
          null,

        paymentConfirmedAt:
          payment.order
            .paymentConfirmedAt
            ?.toISOString() ??
          null,

        finalizedAt:
          payment.order
            .finalizedAt
            ?.toISOString() ??
          null,

        ticketsIssuedAt:
          payment.order
            .ticketsIssuedAt
            ?.toISOString() ??
          null,

        paidAt:
          payment.order.paidAt
            ?.toISOString() ??
          null,

        event:
          payment.order.event,
      },

      tickets: {
        ready:
          ticketsReady,

        expected:
          expectedTicketsCount,

        issued:
          issuedTicketsCount,

        valid:
          validTicketsCount,
      },

      redirectTo,
    });
  } catch (
    error
  ) {
    const paymentError =
      getPaymentError(
        error,
        {
          code:
            "PAYMENT_INTERNAL_ERROR",

          message:
            "Impossible de consulter le paiement pour le moment.",

          status:
            500,

          exposeMessage:
            false,
        },
      );

    console.error(
      "[CLIENT_PAYMENT_STATUS_ERROR]",
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