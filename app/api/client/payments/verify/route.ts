import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";

import {
  PaymentStatus,
  Prisma,
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
export const revalidate = 0;

const DEFAULT_CLIENT_SESSION_COOKIE_NAME =
  "tikemia_client_session";

const LEGACY_SESSION_COOKIE_NAME =
  "tikemia_session";

const verifyPaymentSchema = z
  .object({
    /*
     * Cette valeur peut être :
     *
     * - l’identifiant interne Prisma du paiement ;
     * - l’identifiant de transaction Moneroo, par exemple py_xxx ;
     * - la référence fournisseur.
     */
    paymentId: z
      .string()
      .trim()
      .min(
        1,
        "L’identifiant du paiement est obligatoire.",
      )
      .max(
        255,
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
        255,
        "L’identifiant de la commande est invalide.",
      )
      .optional(),

    /*
     * Nécessaire pour une commande invitée.
     *
     * Le jeton doit être récupéré depuis le sessionStorage par la page
     * de retour et envoyé dans cette requête.
     */
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

    /*
     * Jeton signé présent dans l'URL de retour Moneroo.
     *
     * Il sert uniquement à autoriser une commande invitée à demander
     * la vérification de SON paiement. Il ne prouve jamais que le
     * paiement est réussi.
     */
    returnToken: z
      .string()
      .trim()
      .min(
        32,
        "Le jeton de retour est invalide.",
      )
      .max(
        2000,
        "Le jeton de retour est trop long.",
      )
      .optional(),
  })
  .strict()
  .refine(
    (value) =>
      Boolean(
        value.paymentId ||
          value.orderId,
      ),
    {
      message:
        "L’identifiant du paiement ou de la commande est obligatoire.",
      path: [
        "paymentId",
      ],
    },
  );

type AuthenticatedCustomer = {
  id: string;
  email: string;
};

type PaymentLookupInput = {
  paymentIdentifier:
    | string
    | null;

  orderId:
    | string
    | null;
};

function jsonResponse(
  body: Record<
    string,
    unknown
  >,
  status = 200,
) {
  return NextResponse.json(
    body,
    {
      status,

      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate, max-age=0",

        Pragma:
          "no-cache",

        Expires:
          "0",

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
    .update(token)
    .digest("hex");
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


type PaymentReturnTokenPayload = Readonly<{
  paymentId: string;
  orderId: string;
  expiresAt: number;
}>;

function safeEqualBuffers(
  left: Buffer,
  right: Buffer,
): boolean {
  if (
    left.length !==
    right.length
  ) {
    return false;
  }

  return timingSafeEqual(
    left,
    right,
  );
}

function parsePaymentReturnTokenPayload(
  encodedPayload: string,
): PaymentReturnTokenPayload | null {
  try {
    const decoded =
      Buffer.from(
        encodedPayload,
        "base64url",
      ).toString(
        "utf8",
      );

    const parsed =
      JSON.parse(
        decoded,
      ) as unknown;

    if (
      typeof parsed !==
        "object" ||
      parsed === null ||
      Array.isArray(
        parsed,
      )
    ) {
      return null;
    }

    const record =
      parsed as Record<
        string,
        unknown
      >;

    const paymentId =
      normalizeText(
        typeof record.paymentId ===
          "string"
          ? record.paymentId
          : "",
      );

    const orderId =
      normalizeText(
        typeof record.orderId ===
          "string"
          ? record.orderId
          : "",
      );

    const expiresAt =
      typeof record.expiresAt ===
        "number"
        ? record.expiresAt
        : Number.NaN;

    if (
      !paymentId ||
      !orderId ||
      !Number.isSafeInteger(
        expiresAt,
      ) ||
      expiresAt <= 0
    ) {
      return null;
    }

    return {
      paymentId,
      orderId,
      expiresAt,
    };
  } catch {
    return null;
  }
}

function assertValidPaymentReturnToken({
  returnToken,
  checkoutTokenHash,
  paymentId,
  orderId,
}: {
  returnToken: string;
  checkoutTokenHash: string;
  paymentId: string;
  orderId: string;
}): void {
  const normalizedToken =
    normalizeText(
      returnToken,
    );

  const parts =
    normalizedToken.split(
      ".",
    );

  if (
    parts.length !==
      2
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_FORBIDDEN",

      message:
        "Le jeton sécurisé de retour est invalide.",

      status:
        403,

      paymentId,

      orderId,
    });
  }

  const [
    encodedPayload,
    receivedSignature,
  ] =
    parts;

  if (
    !encodedPayload ||
    !receivedSignature
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_FORBIDDEN",

      message:
        "Le jeton sécurisé de retour est invalide.",

      status:
        403,

      paymentId,

      orderId,
    });
  }

  const expectedSignature =
    createHmac(
      "sha256",
      checkoutTokenHash,
    )
      .update(
        encodedPayload,
        "utf8",
      )
      .digest(
        "base64url",
      );

  const signatureIsValid =
    safeEqualBuffers(
      Buffer.from(
        receivedSignature,
        "utf8",
      ),
      Buffer.from(
        expectedSignature,
        "utf8",
      ),
    );

  if (
    !signatureIsValid
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_FORBIDDEN",

      message:
        "Le jeton sécurisé de retour est invalide.",

      status:
        403,

      paymentId,

      orderId,
    });
  }

  const payload =
    parsePaymentReturnTokenPayload(
      encodedPayload,
    );

  if (!payload) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_FORBIDDEN",

      message:
        "Le jeton sécurisé de retour est invalide.",

      status:
        403,

      paymentId,

      orderId,
    });
  }

  /*
   * Le token est lié à l'identifiant INTERNE du paiement Tikemia.
   * Même si Moneroo remplace paymentId dans l'URL par son identifiant
   * `py_...`, nous validons ici contre le paiement retrouvé en base.
   */
  if (
    payload.paymentId !==
      paymentId ||
    payload.orderId !==
      orderId
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_TRANSACTION_MISMATCH",

      message:
        "Le jeton sécurisé ne correspond pas à ce paiement.",

      status:
        403,

      paymentId,

      orderId,
    });
  }

  if (
    payload.expiresAt <
    Date.now()
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_UNAUTHORIZED",

      message:
        "Le jeton sécurisé de retour a expiré.",

      status:
        401,

      paymentId,

      orderId,
    });
  }
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
      ].filter(Boolean),
    ),
  );
}

async function getAuthenticatedCustomer(): Promise<
  AuthenticatedCustomer | null
> {
  const cookieStore =
    await cookies();

  let sessionToken = "";

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
        tokenHash:
          hashToken(
            sessionToken,
          ),
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
          id:
            session.id,
        },
      })
      .catch(
        () => undefined,
      );

    return null;
  }

  if (
    session.user.role !==
      UserRole.CUSTOMER ||
    !session.user
      .emailVerified ||
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

function buildPaymentWhere({
  paymentIdentifier,
  orderId,
}: PaymentLookupInput): Prisma.PaymentWhereInput {
  const identifiers:
    Prisma.PaymentWhereInput[] =
    [];

  if (paymentIdentifier) {
    identifiers.push(
      {
        id:
          paymentIdentifier,
      },
      {
        providerTransactionId:
          paymentIdentifier,
      },
      {
        providerReference:
          paymentIdentifier,
      },
    );
  }

  if (orderId) {
    identifiers.push({
      orderId,
    });
  }

  if (
    identifiers.length === 0
  ) {
    return {
      id: {
        equals:
          "__INVALID_PAYMENT_LOOKUP__",
      },
    };
  }

  /*
   * Lorsque paymentId et orderId sont tous les deux présents,
   * on vérifie que le paiement retrouvé appartient bien à cette commande.
   */
  if (
    paymentIdentifier &&
    orderId
  ) {
    return {
      orderId,

      OR: [
        {
          id:
            paymentIdentifier,
        },

        {
          providerTransactionId:
            paymentIdentifier,
        },

        {
          providerReference:
            paymentIdentifier,
        },
      ],
    };
  }

  return {
    OR:
      identifiers,
  };
}

function assertPaymentOwnership({
  customer,
  checkoutToken,
  returnToken,
  paymentId,
  order,
}: {
  customer:
    | AuthenticatedCustomer
    | null;

  checkoutToken: string;
  returnToken: string;
  paymentId: string;

  order: {
    id: string;
    customerId:
      | string
      | null;

    checkoutTokenHash:
      | string
      | null;
  };
}): void {
  /*
   * Client connecté.
   */
  if (customer) {
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

  /*
   * Une commande liée à un compte client ne peut pas être consultée
   * sans session authentifiée.
   */
  if (order.customerId) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_UNAUTHORIZED",

      message:
        "Connectez-vous pour vérifier ce paiement.",

      status:
        401,

      paymentId,
      orderId:
        order.id,
    });
  }

  /*
   * Commande invitée.
   *
   * Deux mécanismes sont acceptés :
   *
   * 1. checkoutToken original conservé dans sessionStorage ;
   * 2. returnToken signé reçu après le retour de Moneroo.
   *
   * Le returnToken n'est PAS une preuve de paiement. Il autorise
   * seulement cette route à poursuivre vers verifyMonerooPayment().
   */
  if (
    !order.checkoutTokenHash
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_UNAUTHORIZED",

      message:
        "Le contexte sécurisé de cette commande est indisponible.",

      status:
        401,

      paymentId,
      orderId:
        order.id,
    });
  }

  if (
    checkoutToken
  ) {
    const suppliedTokenHash =
      hashToken(
        checkoutToken,
      );

    if (
      secureHashEquals(
        suppliedTokenHash,
        order.checkoutTokenHash,
      )
    ) {
      return;
    }

    /*
     * Si un returnToken valide est aussi présent, on peut encore
     * autoriser le retour Moneroo malgré un ancien checkoutToken
     * local devenu incohérent.
     */
    if (!returnToken) {
      throw new PaymentValidationError({
        code:
          "PAYMENT_FORBIDDEN",

        message:
          "Le jeton sécurisé de cette commande est invalide.",

        status:
          403,

        paymentId,
        orderId:
          order.id,
      });
    }
  }

  if (
    returnToken
  ) {
    assertValidPaymentReturnToken({
      returnToken,
      checkoutTokenHash:
        order.checkoutTokenHash,
      paymentId,
      orderId:
        order.id,
    });

    return;
  }

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

function buildDownloadUrl(
  orderId: string,
): string {
  return `/api/client/orders/${encodeURIComponent(
    orderId,
  )}/tickets/download`;
}

function buildSuccessData({
  payment,
  orderStatus,
  ticketCount,
}: {
  payment: {
    id: string;
    orderId: string;
    provider: string;
    providerTransactionId:
      | string
      | null;

    providerReference:
      | string
      | null;

    status:
      PaymentStatus;

    order: {
      id: string;
      reference: string;
      status: string;
      ticketsIssuedAt:
        | Date
        | null;
    };
  };

  orderStatus: string;
  ticketCount: number;
}) {
  const ticketsReady =
    payment.status ===
      PaymentStatus.SUCCESS &&
    orderStatus ===
      "PAID" &&
    Boolean(
      payment.order
        .ticketsIssuedAt,
    );

  return {
    status:
      payment.status,

    paymentStatus:
      payment.status,

    orderStatus,

    payment: {
      id:
        payment.id,

      status:
        payment.status,

      provider:
        payment.provider,

      providerTransactionId:
        payment
          .providerTransactionId,

      providerReference:
        payment
          .providerReference,
    },

    order: {
      id:
        payment.order.id,

      reference:
        payment.order.reference,

      status:
        orderStatus,
    },

    tickets: {
      generated:
        ticketsReady,

      ready:
        ticketsReady,

      count:
        ticketCount,

      downloadUrl:
        ticketsReady
          ? buildDownloadUrl(
              payment.order.id,
            )
          : null,
    },
  };
}

export async function POST(
  request: Request,
) {
  let internalPaymentId:
    | string
    | null = null;

  let requestedPaymentIdentifier:
    | string
    | null = null;

  let requestedOrderId:
    | string
    | null = null;

  try {
    let rawBody:
      unknown;

    try {
      rawBody =
        await request.json();
    } catch {
      return jsonResponse(
        {
          success:
            false,

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

    if (
      !parsedBody.success
    ) {
      return jsonResponse(
        {
          success:
            false,

          error: {
            code:
              "PAYMENT_INVALID_REQUEST",

            message:
              parsedBody.error
                .issues[0]
                ?.message ??
              "Les informations du paiement sont invalides.",

            field:
              parsedBody.error
                .issues[0]
                ?.path.join(
                  ".",
                ) ??
              null,
          },
        },
        400,
      );
    }

    const input =
      parsedBody.data;

    requestedPaymentIdentifier =
      normalizeText(
        input.paymentId,
      ) || null;

    requestedOrderId =
      normalizeText(
        input.orderId,
      ) || null;

    const [
      customer,
      payment,
    ] = await Promise.all([
      getAuthenticatedCustomer(),

      prisma.payment.findFirst({
        where:
          buildPaymentWhere({
            paymentIdentifier:
              requestedPaymentIdentifier,

            orderId:
              requestedOrderId,
          }),

        orderBy: {
          createdAt:
            "desc",
        },

        select: {
          id: true,
          orderId: true,
          provider: true,

          providerTransactionId:
            true,

          providerReference:
            true,

          status:
            true,

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

        status:
          404,

        retryable:
          false,

        exposeMessage:
          true,

        paymentId:
          requestedPaymentIdentifier ??
          undefined,

        orderId:
          requestedOrderId ??
          undefined,
      });
    }

    internalPaymentId =
      payment.id;

    requestedOrderId =
      payment.orderId;

    assertPaymentOwnership({
      customer,

      checkoutToken:
        normalizeText(
          input.checkoutToken,
        ),

      returnToken:
        normalizeText(
          input.returnToken,
        ),

      paymentId:
        payment.id,

      order:
        payment.order,
    });

    /*
     * Le paiement a déjà été finalisé.
     * La route reste idempotente : elle ne génère pas les billets une
     * deuxième fois.
     */
    if (
      payment.status ===
        PaymentStatus.SUCCESS &&
      payment.order.status ===
        "PAID" &&
      payment.order
        .ticketsIssuedAt
    ) {
      return jsonResponse({
        success:
          true,

        code:
          "PAYMENT_ALREADY_SUCCESSFUL",

        message:
          "Le paiement est déjà confirmé et les billets sont disponibles.",

        data:
          buildSuccessData({
            payment,

            orderStatus:
              payment.order
                .status,

            ticketCount:
              0,
          }),

        completed:
          true,
      });
    }

    if (
      payment.provider !==
      "MONEROO"
    ) {
      throw new PaymentError({
        code:
          "PAYMENT_PROVIDER_RESPONSE_INVALID",

        message:
          "Cette route de vérification est réservée aux paiements Moneroo.",

        status:
          409,

        retryable:
          false,

        exposeMessage:
          true,

        provider:
          payment.provider,

        paymentId:
          payment.id,

        orderId:
          payment.orderId,
      });
    }

    if (
      !payment
        .providerTransactionId
    ) {
      throw new PaymentError({
        code:
          "PAYMENT_PROVIDER_TRANSACTION_NOT_FOUND",

        message:
          "L’identifiant de transaction Moneroo est absent.",

        status:
          409,

        retryable:
          true,

        exposeMessage:
          true,

        provider:
          payment.provider,

        paymentId:
          payment.id,

        orderId:
          payment.orderId,
      });
    }

    /*
     * Vérification directe auprès de Moneroo.
     *
     * Le paramètre paymentStatus présent dans l’URL n’est jamais utilisé
     * comme preuve du paiement.
     */
    const verified =
      await verifyMonerooPayment({
        paymentId:
          payment.id,

        providerTransactionId:
          payment
            .providerTransactionId,

        signal:
          request.signal,
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
            verified
              .providerTransactionId,

          providerReference:
            verified
              .providerReference,

          gateway:
            verified.gateway,

          paymentMethod:
            verified
              .paymentMethod,

          paidAt:
            verified.verifiedAt,
        });
    }

    const finalOrderStatus =
      verified.status ===
      PaymentStatus.SUCCESS
        ? "PAID"
        : payment.order.status;

    const ticketsReady =
      verified.status ===
      PaymentStatus.SUCCESS &&
      completion !== null;

    const ticketCount =
      completion?.totalTickets ??
      0;

    return jsonResponse({
      success:
        true,

      code:
        verified.status ===
        PaymentStatus.SUCCESS
          ? "PAYMENT_CONFIRMED"
          : "PAYMENT_STATUS_VERIFIED",

      message:
        verified.status ===
        PaymentStatus.SUCCESS
          ? "Le paiement a été confirmé et les billets ont été générés."
          : verified.status ===
                PaymentStatus.PENDING ||
              verified.status ===
                PaymentStatus.PROCESSING
            ? "Le paiement est encore en cours de confirmation."
            : "Le statut du paiement a été vérifié.",

      data: {
        status:
          verified.status,

        paymentStatus:
          verified.status,

        orderStatus:
          finalOrderStatus,

        payment: {
          id:
            verified.paymentId,

          status:
            verified.status,

          provider:
            verified.provider,

          providerTransactionId:
            verified
              .providerTransactionId,

          providerReference:
            verified
              .providerReference,

          rawStatus:
            verified.rawStatus,

          gateway:
            verified.gateway,

          paymentMethod:
            verified
              .paymentMethod,

          amount:
            verified.amount.toFixed(
              2,
            ),

          currency:
            verified.currency,

          terminal:
            verified.isFinal,

          verifiedAt:
            verified.verifiedAt.toISOString(),
        },

        order: {
          id:
            verified.orderId,

          reference:
            completion
              ?.orderReference ??
            payment.order
              .reference,

          status:
            finalOrderStatus,
        },

        tickets: {
          generated:
            ticketsReady,

          ready:
            ticketsReady,

          count:
            ticketCount,

          downloadUrl:
            ticketsReady
              ? buildDownloadUrl(
                  verified.orderId,
                )
              : null,
        },

        completion,
      },

      /*
       * Conservés également au niveau racine pour ne pas casser
       * d’anciens composants qui lisaient encore ces propriétés.
       */
      payment: {
        id:
          verified.paymentId,

        orderId:
          verified.orderId,

        provider:
          verified.provider,

        providerTransactionId:
          verified
            .providerTransactionId,

        providerReference:
          verified
            .providerReference,

        status:
          verified.status,

        rawStatus:
          verified.rawStatus,

        gateway:
          verified.gateway,

        paymentMethod:
          verified
            .paymentMethod,

        amount:
          verified.amount.toFixed(
            2,
          ),

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
      getPaymentError(
        error,
        {
          code:
            "PAYMENT_INTERNAL_ERROR",

          message:
            "Impossible de vérifier le paiement pour le moment.",

          status:
            500,

          exposeMessage:
            false,

          paymentId:
            internalPaymentId ??
            requestedPaymentIdentifier,

          orderId:
            requestedOrderId,
        },
      );

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