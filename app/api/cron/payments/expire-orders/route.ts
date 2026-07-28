import {
  timingSafeEqual,
} from "node:crypto";

import {
  OrderStatus,
  PaymentStatus,
  Prisma,
  TicketReservationStatus,
} from "@prisma/client";
import {
  NextResponse,
} from "next/server";

import {
  getPaymentError,
  getPaymentErrorLogContext,
} from "@/lib/payments/payment-errors";
import {
  prisma,
} from "@/lib/prisma";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const maxDuration =
  60;

const DEFAULT_LIMIT =
  50;

const MAX_LIMIT =
  200;

const DEFAULT_TRANSACTION_TIMEOUT_MS =
  20_000;

type JsonRecord =
  Record<string, unknown>;

type ExpiredOrderResult = {
  orderId: string;
  orderReference: string;

  status:
    | "EXPIRED"
    | "SKIPPED"
    | "FAILED";

  releasedReservations: number;
  releasedTickets: number;

  paymentUpdated: boolean;
  paymentAttemptsUpdated: number;

  errorCode: string | null;
  errorMessage: string | null;
};

function jsonResponse(
  body:
    JsonRecord,
  status =
    200,
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

function secureEquals(
  left:
    string,
  right:
    string,
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

function getCronSecret(): string {
  const secret =
    normalizeText(
      process.env
        .CRON_SECRET,
    );

  if (!secret) {
    throw new Error(
      "CRON_SECRET_MISSING",
    );
  }

  return secret;
}

function getAuthorizationToken(
  request:
    Request,
): string {
  const authorization =
    normalizeText(
      request.headers.get(
        "authorization",
      ),
    );

  if (
    authorization
      .toLowerCase()
      .startsWith(
        "bearer ",
      )
  ) {
    return authorization
      .slice(
        7,
      )
      .trim();
  }

  return normalizeText(
    request.headers.get(
      "x-cron-secret",
    ),
  );
}

function assertAuthorized(
  request:
    Request,
): void {
  const receivedSecret =
    getAuthorizationToken(
      request,
    );

  const expectedSecret =
    getCronSecret();

  if (
    !receivedSecret ||
    !secureEquals(
      receivedSecret,
      expectedSecret,
    )
  ) {
    throw new Error(
      "CRON_UNAUTHORIZED",
    );
  }
}

function parsePositiveInteger({
  value,
  fallback,
  maximum,
}: {
  value:
    string | null;
  fallback:
    number;
  maximum:
    number;
}): number {
  const parsed =
    Number.parseInt(
      value ?? "",
      10,
    );

  if (
    !Number.isInteger(
      parsed,
    ) ||
    parsed <=
      0
  ) {
    return fallback;
  }

  return Math.min(
    parsed,
    maximum,
  );
}

function truncateErrorMessage(
  value:
    string,
): string {
  return value
    .replace(
      /\s+/g,
      " ",
    )
    .trim()
    .slice(
      0,
      1_900,
    );
}

async function expireSingleOrder({
  orderId,
  now,
}: {
  orderId:
    string;
  now:
    Date;
}): Promise<
  ExpiredOrderResult
> {
  return prisma.$transaction(
    async (
      transaction,
    ) => {
      const order =
        await transaction
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

              reservationExpiresAt:
                true,

              payment: {
                select: {
                  id:
                    true,

                  status:
                    true,
                },
              },

              reservations: {
                where: {
                  status:
                    TicketReservationStatus
                      .PENDING,
                },

                orderBy: {
                  createdAt:
                    "asc",
                },

                select: {
                  id:
                    true,

                  ticketTypeId:
                    true,

                  quantity:
                    true,

                  expiresAt:
                    true,
                },
              },
            },
          });

      if (
        !order
      ) {
        return {
          orderId,

          orderReference:
            orderId,

          status:
            "SKIPPED",

          releasedReservations:
            0,

          releasedTickets:
            0,

          paymentUpdated:
            false,

          paymentAttemptsUpdated:
            0,

          errorCode:
            "ORDER_NOT_FOUND",

          errorMessage:
            "La commande est introuvable.",
        };
      }

      const orderCanExpire =
        (
          order.status ===
            OrderStatus.PENDING ||
          order.status ===
            OrderStatus.PROCESSING
        ) &&
        Boolean(
          order
            .reservationExpiresAt,
        ) &&
        (
          order
            .reservationExpiresAt
            ?.getTime() ??
          Number.POSITIVE_INFINITY
        ) <=
          now.getTime();

      if (
        !orderCanExpire
      ) {
        return {
          orderId:
            order.id,

          orderReference:
            order.reference,

          status:
            "SKIPPED",

          releasedReservations:
            0,

          releasedTickets:
            0,

          paymentUpdated:
            false,

          paymentAttemptsUpdated:
            0,

          errorCode:
            null,

          errorMessage:
            null,
        };
      }

      const expiredReservations =
        order.reservations.filter(
          (
            reservation,
          ) =>
            reservation.expiresAt.getTime() <=
            now.getTime(),
        );

      let releasedTickets =
        0;

      for (
        const reservation of
        expiredReservations
      ) {
        const stockUpdate =
          await transaction
            .ticketType
            .updateMany({
              where: {
                id:
                  reservation
                    .ticketTypeId,

                reserved: {
                  gte:
                    reservation
                      .quantity,
                },
              },

              data: {
                reserved: {
                  decrement:
                    reservation
                      .quantity,
                },
              },
            });

        if (
          stockUpdate.count !==
          1
        ) {
          throw new Error(
            `RESERVED_STOCK_CONFLICT:${reservation.ticketTypeId}`,
          );
        }

        releasedTickets +=
          reservation.quantity;
      }

      const reservationIds =
        expiredReservations.map(
          (
            reservation,
          ) =>
            reservation.id,
        );

      let releasedReservations =
        0;

      if (
        reservationIds.length >
        0
      ) {
        const reservationsUpdate =
          await transaction
            .ticketReservation
            .updateMany({
              where: {
                id: {
                  in:
                    reservationIds,
                },

                status:
                  TicketReservationStatus
                    .PENDING,
              },

              data: {
                status:
                  TicketReservationStatus
                    .EXPIRED,

                releasedAt:
                  now,
              },
            });

        releasedReservations =
          reservationsUpdate.count;
      }

      const orderUpdate =
        await transaction
          .order
          .updateMany({
            where: {
              id:
                order.id,

              status: {
                in: [
                  OrderStatus.PENDING,
                  OrderStatus.PROCESSING,
                ],
              },

              reservationExpiresAt: {
                lte:
                  now,
              },
            },

            data: {
              status:
                OrderStatus.EXPIRED,

              expiredAt:
                now,

              failedAt:
                null,

              cancelledAt:
                null,
            },
          });

      if (
        orderUpdate.count !==
        1
      ) {
        throw new Error(
          "ORDER_EXPIRATION_CONFLICT",
        );
      }

      let paymentUpdated =
        false;

      let paymentAttemptsUpdated =
        0;

      if (
        order.payment &&
        (
          order.payment.status ===
            PaymentStatus.PENDING ||
          order.payment.status ===
            PaymentStatus.PROCESSING
        )
      ) {
        const paymentUpdate =
          await transaction
            .payment
            .updateMany({
              where: {
                id:
                  order.payment.id,

                status: {
                  in: [
                    PaymentStatus.PENDING,
                    PaymentStatus.PROCESSING,
                  ],
                },
              },

              data: {
                status:
                  PaymentStatus.EXPIRED,

                failureCode:
                  "PAYMENT_RESERVATION_EXPIRED",

                failureReason:
                  "La réservation des billets a expiré avant la confirmation du paiement.",

                failedAt:
                  now,

                cancelledAt:
                  null,
              },
            });

        paymentUpdated =
          paymentUpdate.count ===
          1;

        const attemptsUpdate =
          await transaction
            .paymentAttempt
            .updateMany({
              where: {
                paymentId:
                  order.payment.id,

                status: {
                  in: [
                    PaymentStatus.PENDING,
                    PaymentStatus.PROCESSING,
                  ],
                },
              },

              data: {
                status:
                  PaymentStatus.EXPIRED,

                failureCode:
                  "PAYMENT_RESERVATION_EXPIRED",

                failureReason:
                  "La réservation des billets a expiré avant la confirmation du paiement.",

                failedAt:
                  now,

                cancelledAt:
                  null,
              },
            });

        paymentAttemptsUpdated =
          attemptsUpdate.count;
      }

      return {
        orderId:
          order.id,

        orderReference:
          order.reference,

        status:
          "EXPIRED",

        releasedReservations,

        releasedTickets,

        paymentUpdated,

        paymentAttemptsUpdated,

        errorCode:
          null,

        errorMessage:
          null,
      };
    },
    {
      isolationLevel:
        Prisma
          .TransactionIsolationLevel
          .Serializable,

      maxWait:
        10_000,

      timeout:
        DEFAULT_TRANSACTION_TIMEOUT_MS,
    },
  );
}

async function execute(
  request:
    Request,
) {
  const startedAt =
    Date.now();

  try {
    assertAuthorized(
      request,
    );

    const url =
      new URL(
        request.url,
      );

    const limit =
      parsePositiveInteger({
        value:
          url.searchParams.get(
            "limit",
          ),

        fallback:
          DEFAULT_LIMIT,

        maximum:
          MAX_LIMIT,
      });

    const requestedOrderId =
      normalizeText(
        url.searchParams.get(
          "orderId",
        ),
      ) ||
      null;

    const now =
      new Date();

    const orders =
      requestedOrderId
        ? await prisma.order
            .findMany({
              where: {
                id:
                  requestedOrderId,

                status: {
                  in: [
                    OrderStatus.PENDING,
                    OrderStatus.PROCESSING,
                  ],
                },

                reservationExpiresAt: {
                  lte:
                    now,
                },
              },

              select: {
                id:
                  true,
              },

              take:
                1,
            })
        : await prisma.order
            .findMany({
              where: {
                status: {
                  in: [
                    OrderStatus.PENDING,
                    OrderStatus.PROCESSING,
                  ],
                },

                reservationExpiresAt: {
                  lte:
                    now,
                },
              },

              orderBy: [
                {
                  reservationExpiresAt:
                    "asc",
                },

                {
                  createdAt:
                    "asc",
                },
              ],

              select: {
                id:
                  true,
              },

              take:
                limit,
            });

    const results:
      ExpiredOrderResult[] =
      [];

    for (
      const order of
      orders
    ) {
      try {
        results.push(
          await expireSingleOrder({
            orderId:
              order.id,

            now,
          }),
        );
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
                "Impossible d’expirer cette commande.",

              status:
                500,

              exposeMessage:
                false,

              orderId:
                order.id,
            },
          );

        console.error(
          "[CRON_EXPIRE_ORDER_ITEM_ERROR]",
          getPaymentErrorLogContext(
            paymentError,
          ),
        );

        results.push({
          orderId:
            order.id,

          orderReference:
            order.id,

          status:
            "FAILED",

          releasedReservations:
            0,

          releasedTickets:
            0,

          paymentUpdated:
            false,

          paymentAttemptsUpdated:
            0,

          errorCode:
            paymentError.code,

          errorMessage:
            truncateErrorMessage(
              paymentError
                .exposeMessage
                ? paymentError.message
                : "L’expiration de la commande a échoué.",
            ),
        });
      }
    }

    const expiredOrders =
      results.filter(
        (
          result,
        ) =>
          result.status ===
          "EXPIRED",
      );

    const failedOrders =
      results.filter(
        (
          result,
        ) =>
          result.status ===
          "FAILED",
      );

    const skippedOrders =
      results.filter(
        (
          result,
        ) =>
          result.status ===
          "SKIPPED",
      );

    return jsonResponse({
      success:
        failedOrders.length ===
        0,

      durationMs:
        Date.now() -
        startedAt,

      summary: {
        selectedOrders:
          orders.length,

        expiredOrders:
          expiredOrders.length,

        failedOrders:
          failedOrders.length,

        skippedOrders:
          skippedOrders.length,

        releasedReservations:
          expiredOrders.reduce(
            (
              total,
              result,
            ) =>
              total +
              result
                .releasedReservations,
            0,
          ),

        releasedTickets:
          expiredOrders.reduce(
            (
              total,
              result,
            ) =>
              total +
              result
                .releasedTickets,
            0,
          ),

        updatedPayments:
          expiredOrders.filter(
            (
              result,
            ) =>
              result
                .paymentUpdated,
          ).length,

        updatedPaymentAttempts:
          expiredOrders.reduce(
            (
              total,
              result,
            ) =>
              total +
              result
                .paymentAttemptsUpdated,
            0,
          ),
      },

      results,
    });
  } catch (
    error
  ) {
    if (
      error instanceof
        Error &&
      error.message ===
        "CRON_UNAUTHORIZED"
    ) {
      return jsonResponse(
        {
          success:
            false,

          error: {
            code:
              "CRON_UNAUTHORIZED",

            message:
              "Accès non autorisé.",
          },
        },
        401,
      );
    }

    if (
      error instanceof
        Error &&
      error.message ===
        "CRON_SECRET_MISSING"
    ) {
      console.error(
        "[CRON_EXPIRE_ORDERS_CONFIGURATION_ERROR]",
        {
          message:
            "CRON_SECRET est absent.",
        },
      );

      return jsonResponse(
        {
          success:
            false,

          error: {
            code:
              "CRON_CONFIGURATION_ERROR",

            message:
              "La configuration du traitement automatique est incomplète.",
          },
        },
        500,
      );
    }

    const paymentError =
      getPaymentError(
        error,
        {
          code:
            "PAYMENT_INTERNAL_ERROR",

          message:
            "Impossible d’expirer les commandes.",

          status:
            500,

          exposeMessage:
            false,
        },
      );

    console.error(
      "[CRON_EXPIRE_ORDERS_ERROR]",
      getPaymentErrorLogContext(
        paymentError,
      ),
    );

    return jsonResponse(
      {
        success:
          false,

        durationMs:
          Date.now() -
          startedAt,

        error: {
          code:
            paymentError.code,

          message:
            paymentError
              .exposeMessage
              ? paymentError.message
              : "Le traitement des commandes expirées a échoué.",
        },
      },
      paymentError.status,
    );
  }
}

export async function GET(
  request:
    Request,
) {
  return execute(
    request,
  );
}

export async function POST(
  request:
    Request,
) {
  return execute(
    request,
  );
}