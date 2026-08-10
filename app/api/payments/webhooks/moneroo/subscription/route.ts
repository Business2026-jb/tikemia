import {
  NextResponse,
} from "next/server";

import {
  processSubscriptionPaymentWebhook,
  SubscriptionPaymentWebhookError,
} from "@/lib/organizer/promotions/process-subscription-payment-webhook";
import {
  getPaymentErrorLogContext,
} from "@/lib/payments/payment-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

const MAX_WEBHOOK_BODY_BYTES =
  1 * 1024 * 1024;

type WebhookSuccessResponse =
  Readonly<{
    success: true;
    received: true;
    duplicate: boolean;
    message: string;
    payment: {
      id: string;
      subscriptionId: string;
      organizerId: string;
      providerTransactionId: string;
      providerReference: string | null;
      status: string;
    };
    subscription: {
      status: string;
      activated: boolean;
    };
  }>;

type WebhookErrorResponse =
  Readonly<{
    success: false;
    received: false;
    error: {
      code: string;
      message: string;
      paymentId: string | null;
      subscriptionId: string | null;
    };
  }>;

type WebhookResponse =
  | WebhookSuccessResponse
  | WebhookErrorResponse;

function jsonResponse(
  body: WebhookResponse,
  status = 200,
): NextResponse<WebhookResponse> {
  return NextResponse.json(
    body,
    {
      status,
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma:
          "no-cache",
        Expires:
          "0",
        "X-Content-Type-Options":
          "nosniff",
        "Referrer-Policy":
          "no-referrer",
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

function getConfiguredSignatureHeaderName():
  string | null {
  const configured =
    normalizeText(
      process.env
        .MONEROO_WEBHOOK_SIGNATURE_HEADER,
    );

  if (!configured) {
    return null;
  }

  return configured.toLowerCase();
}

/**
 * Moneroo doit signer le corps brut du webhook.
 *
 * Le nom du header peut être configuré avec
 * MONEROO_WEBHOOK_SIGNATURE_HEADER. Les fallbacks ci-dessous permettent de
 * rester compatible avec les variantes courantes sans modifier la fonction
 * centrale de validation de signature.
 */
function getWebhookSignature(
  request: Request,
): string | null {
  const configuredHeader =
    getConfiguredSignatureHeaderName();

  if (configuredHeader) {
    const configuredValue =
      normalizeText(
        request.headers.get(
          configuredHeader,
        ),
      );

    if (configuredValue) {
      return configuredValue;
    }
  }

  const candidateHeaders =
    [
      "x-moneroo-signature",
      "moneroo-signature",
      "x-webhook-signature",
      "webhook-signature",
      "x-signature",
    ] as const;

  for (
    const headerName of
      candidateHeaders
  ) {
    const value =
      normalizeText(
        request.headers.get(
          headerName,
        ),
      );

    if (value) {
      return value;
    }
  }

  return null;
}

function getContentLength(
  request: Request,
): number | null {
  const rawValue =
    normalizeText(
      request.headers.get(
        "content-length",
      ),
    );

  if (!rawValue) {
    return null;
  }

  const parsed =
    Number(rawValue);

  if (
    !Number.isSafeInteger(
      parsed,
    ) ||
    parsed < 0
  ) {
    return null;
  }

  return parsed;
}

function bodyTooLargeResponse():
  NextResponse<WebhookResponse> {
  return jsonResponse(
    {
      success: false,
      received: false,
      error: {
        code:
          "SUBSCRIPTION_WEBHOOK_BODY_TOO_LARGE",
        message:
          "Le webhook Moneroo dépasse la taille autorisée.",
        paymentId:
          null,
        subscriptionId:
          null,
      },
    },
    413,
  );
}

function readErrorStatus(
  error:
    SubscriptionPaymentWebhookError,
): number {
  if (
    Number.isInteger(
      error.status,
    ) &&
    error.status >= 400 &&
    error.status <= 599
  ) {
    return error.status;
  }

  return 500;
}

function safeErrorMessage(
  error:
    SubscriptionPaymentWebhookError,
): string {
  /*
   * Les erreurs fonctionnelles explicitement produites par notre processeur
   * peuvent être retournées. Les erreurs internes enveloppées utilisent déjà
   * un message générique et ne doivent jamais exposer de secret fournisseur.
   */
  return (
    normalizeText(
      error.message,
    ) ||
    "Impossible de traiter le webhook Moneroo de l’abonnement Premium."
  );
}

export async function POST(
  request: Request,
): Promise<
  NextResponse<WebhookResponse>
> {
  /*
   * Un content-length supérieur à la limite permet de rejeter immédiatement
   * la requête avant même de charger son contenu en mémoire.
   */
  const contentLength =
    getContentLength(
      request,
    );

  if (
    contentLength !== null &&
    contentLength >
      MAX_WEBHOOK_BODY_BYTES
  ) {
    return bodyTooLargeResponse();
  }

  let rawBody: string;

  try {
    /*
     * IMPORTANT :
     * ne jamais remplacer request.text() par request.json().
     *
     * La signature Moneroo porte sur le contenu brut exact. Parser puis
     * sérialiser le JSON modifierait potentiellement les octets signés.
     */
    rawBody =
      await request.text();
  } catch (error) {
    console.error(
      "[ORGANIZER_SUBSCRIPTION_WEBHOOK_BODY_READ_ERROR]",
      error instanceof Error
        ? {
            name:
              error.name,
            message:
              error.message,
          }
        : error,
    );

    return jsonResponse(
      {
        success: false,
        received: false,
        error: {
          code:
            "SUBSCRIPTION_WEBHOOK_BODY_READ_FAILED",
          message:
            "Impossible de lire le webhook Moneroo.",
          paymentId:
            null,
          subscriptionId:
            null,
        },
      },
      400,
    );
  }

  if (
    Buffer.byteLength(
      rawBody,
      "utf8",
    ) >
    MAX_WEBHOOK_BODY_BYTES
  ) {
    return bodyTooLargeResponse();
  }

  const signature =
    getWebhookSignature(
      request,
    );

  try {
    const result =
      await processSubscriptionPaymentWebhook({
        rawBody,
        signature,
        signal:
          request.signal,
      });

    const message =
      result.duplicate
        ? "Le paiement de cet abonnement Premium a déjà été traité."
        : result.activated
          ? "Le paiement a été confirmé et l’abonnement Premium est actif."
          : result.paymentStatus ===
                "PENDING" ||
              result.paymentStatus ===
                "PROCESSING"
            ? "Le webhook a été reçu. Le paiement est encore en cours de traitement."
            : "Le webhook Moneroo a été traité.";

    /*
     * Un webhook correctement authentifié et traité reçoit toujours 200.
     * Cela évite que Moneroo rejoue inutilement un événement déjà pris en
     * compte, y compris pour un statut métier FAILED/CANCELLED/EXPIRED.
     */
    return jsonResponse(
      {
        success: true,
        received: true,
        duplicate:
          result.duplicate,
        message,
        payment: {
          id:
            result.paymentId,
          subscriptionId:
            result.subscriptionId,
          organizerId:
            result.organizerId,
          providerTransactionId:
            result
              .providerTransactionId,
          providerReference:
            result
              .providerReference,
          status:
            result.paymentStatus,
        },
        subscription: {
          status:
            result
              .subscriptionStatus,
          activated:
            result.activated,
        },
      },
      200,
    );
  } catch (error) {
    if (
      error instanceof
      SubscriptionPaymentWebhookError
    ) {
      console.error(
        "[ORGANIZER_SUBSCRIPTION_WEBHOOK_REJECTED]",
        {
          name:
            error.name,
          code:
            error.code,
          status:
            error.status,
          paymentId:
            error.paymentId,
          subscriptionId:
            error.subscriptionId,
          message:
            error.message,
          cause:
            error.causeValue instanceof
              Error
              ? {
                  name:
                    error
                      .causeValue
                      .name,
                  message:
                    error
                      .causeValue
                      .message,
                }
              : undefined,
        },
      );

      return jsonResponse(
        {
          success: false,
          received: false,
          error: {
            code:
              error.code,
            message:
              safeErrorMessage(
                error,
              ),
            paymentId:
              error.paymentId,
            subscriptionId:
              error
                .subscriptionId,
          },
        },
        readErrorStatus(
          error,
        ),
      );
    }

    console.error(
      "[ORGANIZER_SUBSCRIPTION_WEBHOOK_UNEXPECTED_ERROR]",
      getPaymentErrorLogContext(
        error,
      ),
    );

    return jsonResponse(
      {
        success: false,
        received: false,
        error: {
          code:
            "SUBSCRIPTION_WEBHOOK_INTERNAL_ERROR",
          message:
            "Impossible de traiter le webhook Moneroo de l’abonnement Premium.",
          paymentId:
            null,
          subscriptionId:
            null,
        },
      },
      500,
    );
  }
}

/*
 * Un endpoint webhook n'accepte volontairement pas GET.
 * On fournit une réponse simple pour faciliter les diagnostics lorsqu'une
 * personne ouvre accidentellement l'URL dans un navigateur.
 */
export async function GET():
  Promise<
    NextResponse<WebhookResponse>
  > {
  return jsonResponse(
    {
      success: false,
      received: false,
      error: {
        code:
          "SUBSCRIPTION_WEBHOOK_METHOD_NOT_ALLOWED",
        message:
          "Cette route accepte uniquement les webhooks Moneroo en POST.",
        paymentId:
          null,
        subscriptionId:
          null,
      },
    },
    405,
  );
}