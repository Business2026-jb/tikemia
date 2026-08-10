import {
  createHash,
  timingSafeEqual,
} from "node:crypto";

import {
  UserRole,
} from "@prisma/client";
import {
  cookies,
} from "next/headers";
import {
  NextResponse,
} from "next/server";
import {
  z,
} from "zod";

import {
  CouponError,
  serializeCouponError,
} from "@/lib/coupons/coupon-errors";
import {
  prisma,
} from "@/lib/prisma";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

export const maxDuration =
  30;

const DEFAULT_CLIENT_SESSION_COOKIE_NAME =
  "tikemia_client_session";

const LEGACY_SESSION_COOKIE_NAME =
  "tikemia_session";

type AuthenticatedCustomer =
  Readonly<{
    id: string;
    email: string;
  }>;

const requestSchema =
  z.object({
    orderId:
      z.string()
        .trim()
        .min(
          1,
          "L’identifiant de la commande est obligatoire.",
        )
        .max(
          191,
          "L’identifiant de la commande est invalide.",
        ),

    eventId:
      z.string()
        .trim()
        .min(
          1,
          "L’identifiant de l’événement est obligatoire.",
        )
        .max(
          191,
          "L’identifiant de l’événement est invalide.",
        ),

    code:
      z.string()
        .trim()
        .min(
          1,
          "Le code promo est obligatoire.",
        )
        .max(
          100,
          "Le code promo est trop long.",
        )
        .optional(),

    checkoutToken:
      z.string()
        .trim()
        .min(
          32,
          "Le jeton sécurisé de la commande est invalide.",
        )
        .max(
          500,
          "Le jeton sécurisé de la commande est trop long.",
        )
        .optional(),
  })
  .strict();

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
    leftBuffer.length ===
      0 ||
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

function getSessionCookieNames():
  string[] {
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
      ]
        .filter(
          Boolean,
        ),
    ),
  );
}

async function getAuthenticatedCustomer():
  Promise<
    AuthenticatedCustomer
    | null
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
        cookieStore
          .get(
            cookieName,
          )
          ?.value,
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
    await prisma
      .session
      .findUnique({
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
    session.expiresAt
      .getTime() <=
    Date.now()
  ) {
    await prisma
      .session
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
    !session.user
      .emailVerified ||
    !session.user
      .isActive
  ) {
    return null;
  }

  return {
    id:
      session.user.id,

    email:
      normalizeText(
        session.user.email,
      )
        .toLowerCase(),
  };
}

function getCheckoutToken(
  request: Request,
  bodyToken:
    | string
    | undefined,
): string {
  const url =
    new URL(
      request.url,
    );

  return (
    normalizeText(
      bodyToken,
    ) ||
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

function assertOrderAccess({
  order,
  customer,
  checkoutToken,
}: {
  order: {
    id: string;
    customerId:
      | string
      | null;
    checkoutTokenHash:
      | string
      | null;
  };

  customer:
    AuthenticatedCustomer
    | null;

  checkoutToken:
    string;
}): void {
  if (
    customer
  ) {
    if (
      order.customerId !==
      customer.id
    ) {
      throw new CouponError({
        code:
          "COUPON_ORDER_NOT_ELIGIBLE",

        message:
          "Cette commande n’appartient pas à votre compte.",

        status:
          403,
      });
    }

    return;
  }

  if (
    order.customerId
  ) {
    throw new CouponError({
      code:
        "COUPON_ORDER_NOT_ELIGIBLE",

      message:
        "Connectez-vous pour modifier cette commande.",

      status:
        401,
    });
  }

  if (
    !checkoutToken ||
    !order.checkoutTokenHash
  ) {
    throw new CouponError({
      code:
        "COUPON_ORDER_NOT_ELIGIBLE",

      message:
        "Le jeton sécurisé de la commande est obligatoire.",

      status:
        401,
    });
  }

  const suppliedHash =
    hashToken(
      checkoutToken,
    );

  if (
    !secureHashEquals(
      suppliedHash,
      order.checkoutTokenHash,
    )
  ) {
    throw new CouponError({
      code:
        "COUPON_ORDER_NOT_ELIGIBLE",

      message:
        "Le jeton sécurisé de cette commande est invalide.",

      status:
        403,
    });
  }
}

async function readJsonBody(
  request: Request,
): Promise<
  unknown
> {
  const contentType =
    request.headers.get(
      "content-type",
    ) ?? "";

  if (
    !contentType
      .toLowerCase()
      .includes(
        "application/json",
      )
  ) {
    throw new CouponError({
      code:
        "COUPON_CODE_INVALID",

      message:
        "Le format de la requête est invalide.",

      status:
        415,
    });
  }

  try {
    return await request
      .json();
  } catch {
    throw new CouponError({
      code:
        "COUPON_CODE_INVALID",

      message:
        "Le corps JSON de la requête est invalide.",

      status:
        400,
    });
  }
}

function jsonResponse(
  body:
    Record<
      string,
      unknown
    >,
  status =
    200,
): NextResponse {
  return NextResponse
    .json(
      body,
      {
        status,

        headers: {
          "Cache-Control":
            "private, no-store, no-cache, must-revalidate, max-age=0",

          Pragma:
            "no-cache",

          Expires:
            "0",

          "Content-Type":
            "application/json; charset=utf-8",

          "X-Content-Type-Options":
            "nosniff",

          "Referrer-Policy":
            "no-referrer",
        },
      },
    );
}

async function getAuthorizedOrder({
  request,
  orderId,
  eventId,
  checkoutToken,
}: {
  request:
    Request;

  orderId:
    string;

  eventId:
    string;

  checkoutToken:
    | string
    | undefined;
}) {
  const [
    customer,
    order,
  ] =
    await Promise.all([
      getAuthenticatedCustomer(),

      prisma.order
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

            eventId:
              true,

            customerId:
              true,

            customerEmail:
              true,

            checkoutTokenHash:
              true,

            currency:
              true,

            subtotal:
              true,

            platformFee:
              true,

            total:
              true,

            status:
              true,

            reservationExpiresAt:
              true,
          },
        }),
    ]);

  if (
    !order
  ) {
    throw new CouponError({
      code:
        "COUPON_ORDER_NOT_FOUND",

      message:
        "Cette commande est introuvable.",

      status:
        404,
    });
  }

  if (
    order.eventId !==
    eventId
  ) {
    throw new CouponError({
      code:
        "COUPON_EVENT_MISMATCH",

      message:
        "Cette commande ne correspond pas à l’événement sélectionné.",

      status:
        409,
    });
  }

  assertOrderAccess({
    order,
    customer,

    checkoutToken:
      getCheckoutToken(
        request,
        checkoutToken,
      ),
  });

  if (
    ![
      "PENDING",
      "PROCESSING",
    ]
      .includes(
        order.status,
      )
  ) {
    throw new CouponError({
      code:
        "COUPON_ORDER_NOT_ELIGIBLE",

      message:
        "Un code promo ne peut plus être appliqué à cette commande.",

      status:
        409,

      details: {
        orderStatus:
          order.status,
      },
    });
  }

  if (
    order.reservationExpiresAt &&
    order.reservationExpiresAt
      .getTime() <=
    Date.now()
  ) {
    throw new CouponError({
      code:
        "COUPON_ORDER_NOT_ELIGIBLE",

      message:
        "La réservation a expiré. Recommencez la commande.",

      status:
        409,
    });
  }

  return {
    customer,
    order,
  };
}

function serializeValidatedCoupon(
  result: {
    coupon: {
      id:
        string;

      code:
        string;

      description:
        | string
        | null;

      discountType:
        string;

      discountValue:
        string;
    };

    amounts: {
      subtotal:
        string;

      platformFee:
        string;

      discountAmount:
        string;

      discountedSubtotal:
        string;

      discountedPlatformFee:
        string;

      total:
        string;

      currency:
        string;
    };
  },
) {
  return {
    coupon: {
      id:
        result.coupon.id,

      code:
        result.coupon.code,

      description:
        result.coupon.description,

      discountType:
        result.coupon
          .discountType,

      discountValue:
        result.coupon
          .discountValue,
    },

    amounts:
      result.amounts,
  };
}


import {
  applyCouponToOrder,
} from "@/lib/coupons/apply-coupon-to-order";

export async function POST(
  request:
    Request,
): Promise<
  NextResponse
> {
  try {
    const body =
      await readJsonBody(
        request,
      );

    const parsed =
      requestSchema
        .safeParse(
          body,
        );

    if (
      !parsed.success ||
      !parsed.data.code
    ) {
      throw new CouponError({
        code:
          "COUPON_CODE_INVALID",

        message:
          parsed.success
            ? "Le code promo est obligatoire."
            : (
                parsed.error
                  .issues[0]
                  ?.message ??
                "Les informations du code promo sont invalides."
              ),

        status:
          400,

        details:
          parsed.success
            ? null
            : {
                fields:
                  parsed.error
                    .flatten()
                    .fieldErrors,
              },
      });
    }

    await getAuthorizedOrder({
      request,

      orderId:
        parsed.data.orderId,

      eventId:
        parsed.data.eventId,

      checkoutToken:
        parsed.data
          .checkoutToken,
    });

    const result =
      await applyCouponToOrder({
        orderId:
          parsed.data.orderId,

        code:
          parsed.data.code,
      });

    return jsonResponse({
      success:
        true,

      message:
        "Le code promo a été appliqué.",

      ...serializeValidatedCoupon(
        result,
      ),

      order: {
        id:
          result.order.id,

        reference:
          result.order
            .reference,

        eventId:
          result.order.eventId,

        status:
          result.order.status,
      },
    });
  } catch (
    error
  ) {
    console.error(
      "[CLIENT_CHECKOUT_COUPON_APPLY_ERROR]",
      error,
    );

    const serialized =
      serializeCouponError(
        error,
      );

    return jsonResponse(
      {
        success:
          false,

        error: {
          code:
            serialized.code,

          message:
            serialized.message,

          retryable:
            serialized.retryable,

          details:
            serialized.details,
        },
      },
      serialized.status,
    );
  }
}
