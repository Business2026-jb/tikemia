import { createHash } from "node:crypto";

import { UserRole } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createSubscriptionPayment,
} from "@/lib/organizer/promotions/create-subscription-payment";
import {
  PaymentError,
  getPaymentError,
  getPaymentErrorLogContext,
} from "@/lib/payments/payment-errors";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

const SESSION_COOKIE_FALLBACK_NAME =
  "tikemia_session";

const createSubscriptionPaymentSchema =
  z
    .object({
      subscriptionId: z
        .string()
        .trim()
        .min(
          1,
          "L’abonnement Premium est obligatoire.",
        )
        .max(
          100,
          "L’identifiant de l’abonnement Premium est invalide.",
        ),
    })
    .strict();

type AuthenticatedOrganizer = {
  id: string;
};

type RouteSuccessResponse = {
  success: true;
  message: string;
  payment: {
    id: string;
    subscriptionId: string;
    provider: string;
    providerTransactionId: string | null;
    providerReference: string | null;
    checkoutUrl: string;
    returnUrl: string;
    cancelUrl: string;
    amount: string;
    currency: string;
    status: string;
    alreadyPrepared: boolean;
  };
};

type RouteErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
    retryable?: boolean;
    provider?: string | null;
    providerReference?: string | null;
    paymentId?: string | null;
    details?: Record<string, unknown>;
  };
  redirectTo?: string;
};

type RouteResponse =
  | RouteSuccessResponse
  | RouteErrorResponse;

function noStoreHeaders(): HeadersInit {
  return {
    "Cache-Control":
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "X-Content-Type-Options":
      "nosniff",
  };
}

function jsonResponse(
  body: RouteResponse,
  status = 200,
): NextResponse<RouteResponse> {
  return NextResponse.json(
    body,
    {
      status,
      headers:
        noStoreHeaders(),
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

function hashSessionToken(
  token: string,
): string {
  return createHash(
    "sha256",
  )
    .update(token)
    .digest("hex");
}

function hasJsonContentType(
  request: Request,
): boolean {
  const contentType =
    request.headers
      .get("content-type")
      ?.toLowerCase() ?? "";

  return contentType.includes(
    "application/json",
  );
}

async function parseJsonBody(
  request: Request,
): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function getAuthenticatedOrganizer(): Promise<AuthenticatedOrganizer | null> {
  const cookieStore =
    await cookies();

  const sessionCookieName =
    normalizeText(
      process.env
        .SESSION_COOKIE_NAME,
    ) ||
    SESSION_COOKIE_FALLBACK_NAME;

  const sessionToken =
    normalizeText(
      cookieStore.get(
        sessionCookieName,
      )?.value,
    );

  if (!sessionToken) {
    return null;
  }

  const session =
    await prisma.session.findUnique({
      where: {
        tokenHash:
          hashSessionToken(
            sessionToken,
          ),
      },

      select: {
        id: true,
        expiresAt: true,

        user: {
          select: {
            id: true,
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
      .catch(
        (
          error: unknown,
        ) => {
          console.error(
            "[SUBSCRIPTION_PAYMENT_EXPIRED_SESSION_DELETE_ERROR]",
            error instanceof Error
              ? error.message
              : error,
          );
        },
      );

    return null;
  }

  if (
    session.user.role !==
      UserRole.ORGANIZER ||
    !session.user.emailVerified ||
    !session.user.isActive
  ) {
    return null;
  }

  return {
    id: session.user.id,
  };
}

function unauthorizedResponse():
  NextResponse<RouteResponse> {
  return jsonResponse(
    {
      success: false,
      error: {
        code:
          "PAYMENT_UNAUTHORIZED",
        message:
          "Votre session est absente, invalide ou expirée.",
      },
      redirectTo:
        "/organizer/login",
    },
    401,
  );
}

function unsupportedContentTypeResponse():
  NextResponse<RouteResponse> {
  return jsonResponse(
    {
      success: false,
      error: {
        code:
          "PAYMENT_INVALID_REQUEST",
        message:
          "Les informations doivent être envoyées au format JSON.",
      },
    },
    415,
  );
}

function invalidJsonResponse():
  NextResponse<RouteResponse> {
  return jsonResponse(
    {
      success: false,
      error: {
        code:
          "PAYMENT_INVALID_REQUEST",
        message:
          "Les informations envoyées sont invalides ou illisibles.",
      },
    },
    400,
  );
}

function paymentErrorResponse(
  error: PaymentError,
): NextResponse<RouteResponse> {
  const serialized =
    error.toJSON();

  return jsonResponse(
    {
      success: false,
      error: {
        code:
          serialized.error.code,
        message:
          serialized.error.message,
        retryable:
          serialized.error.retryable,
        provider:
          serialized.error.provider,
        providerReference:
          serialized.error
            .providerReference,
        paymentId:
          serialized.error.paymentId,
        ...(serialized.error
          .details
          ? {
              details:
                serialized.error
                  .details,
            }
          : {}),
      },
    },
    error.status,
  );
}

export async function POST(
  request: Request,
): Promise<
  NextResponse<RouteResponse>
> {
  if (
    !hasJsonContentType(
      request,
    )
  ) {
    return unsupportedContentTypeResponse();
  }

  const organizer =
    await getAuthenticatedOrganizer();

  if (!organizer) {
    return unauthorizedResponse();
  }

  const rawBody =
    await parseJsonBody(
      request,
    );

  if (!rawBody) {
    return invalidJsonResponse();
  }

  const parsedBody =
    createSubscriptionPaymentSchema
      .safeParse(
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
              .issues[0]
              ?.message ??
            "Les informations du paiement de l’abonnement Premium sont invalides.",
          details: {
            field:
              parsedBody.error
                .issues[0]
                ?.path.join(
                  ".",
                ) ??
              null,
          },
        },
      },
      400,
    );
  }

  const subscriptionId =
    parsedBody.data
      .subscriptionId;

  try {
    const payment =
      await createSubscriptionPayment({
        organizerId:
          organizer.id,
        subscriptionId,
        signal:
          request.signal,
      });

    return jsonResponse(
      {
        success: true,
        message:
          payment.alreadyPrepared
            ? "Le paiement de l’abonnement Premium est déjà prêt."
            : "Le paiement sécurisé de l’abonnement Premium a été préparé.",
        payment: {
          id:
            payment.paymentId,
          subscriptionId:
            payment.subscriptionId,
          provider:
            payment.provider,
          providerTransactionId:
            payment.providerTransactionId,
          providerReference:
            payment.providerReference,
          checkoutUrl:
            payment.checkoutUrl,
          returnUrl:
            payment.returnUrl,
          cancelUrl:
            payment.cancelUrl,
          amount:
            payment.amount,
          currency:
            payment.currency,
          status:
            payment.status,
          alreadyPrepared:
            payment.alreadyPrepared,
        },
      },
      payment.alreadyPrepared
        ? 200
        : 201,
    );
  } catch (error) {
    const paymentError =
      getPaymentError(
        error,
        {
          code:
            "PAYMENT_INTERNAL_ERROR",
          message:
            "Impossible de préparer le paiement de l’abonnement Premium pour le moment.",
          status: 500,
          exposeMessage:
            false,
          details: {
            subscriptionId,
            organizerId:
              organizer.id,
          },
        },
      );

    console.error(
      "[ORGANIZER_SUBSCRIPTION_PAYMENT_CREATE_ROUTE_ERROR]",
      getPaymentErrorLogContext(
        paymentError,
      ),
    );

    return paymentErrorResponse(
      paymentError,
    );
  }
}