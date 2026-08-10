import "server-only";

import {
  PaymentStatus,
  Prisma,
  SubscriptionStatus,
} from "@prisma/client";

import {
  activateOrganizerSubscription,
  type UpdateSubscriptionResult,
} from "@/lib/organizer/promotions/update-subscription";
import {
  getPaymentError,
  getPaymentErrorLogContext,
} from "@/lib/payments/payment-errors";
import {
  assertValidMonerooWebhookSignature,
} from "@/lib/payments/providers/moneroo/moneroo-signature";
import {
  monerooProvider,
  type MonerooPaymentResult,
} from "@/lib/payments/providers/moneroo/moneroo-provider";
import {
  isRecord,
} from "@/lib/payments/providers/moneroo/moneroo-types";
import { prisma } from "@/lib/prisma";

const MONEROO_PROVIDER = "MONEROO";

type JsonRecord =
  Record<string, unknown>;

type SubscriptionWebhookMetadata =
  Readonly<{
    source?: unknown;
    type?: unknown;
    paymentId?: unknown;
    subscriptionId?: unknown;
    organizerId?: unknown;
    planId?: unknown;
    planCode?: unknown;
    currency?: unknown;
    selectedProvider?: unknown;
  }>;

export type ProcessSubscriptionPaymentWebhookInput =
  Readonly<{
    rawBody: string;
    signature:
      | string
      | null
      | undefined;
    signal?: AbortSignal;
  }>;

export type ProcessSubscriptionPaymentWebhookResult =
  Readonly<{
    paymentId: string;
    subscriptionId: string;
    organizerId: string;
    providerTransactionId: string;
    providerReference: string | null;
    paymentStatus: PaymentStatus;
    subscriptionStatus: SubscriptionStatus;
    duplicate: boolean;
    activated: boolean;
    activation:
      | UpdateSubscriptionResult
      | null;
  }>;

export class SubscriptionPaymentWebhookError
  extends Error {
  readonly code: string;
  readonly status: number;
  readonly paymentId:
    | string
    | null;
  readonly subscriptionId:
    | string
    | null;
  readonly causeValue: unknown;

  constructor({
    code,
    message,
    status = 400,
    paymentId = null,
    subscriptionId = null,
    cause,
  }: {
    code: string;
    message: string;
    status?: number;
    paymentId?: string | null;
    subscriptionId?: string | null;
    cause?: unknown;
  }) {
    super(message, {
      cause,
    });

    this.name =
      "SubscriptionPaymentWebhookError";
    this.code = code;
    this.status = status;
    this.paymentId =
      paymentId;
    this.subscriptionId =
      subscriptionId;
    this.causeValue = cause;

    Object.setPrototypeOf(
      this,
      new.target.prototype,
    );
  }
}

function normalizeText(
  value: unknown,
): string {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function normalizeUpperText(
  value: unknown,
): string {
  return normalizeText(
    value,
  ).toUpperCase();
}

function toJsonValue(
  value: unknown,
): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(value),
  ) as Prisma.InputJsonValue;
}

function readJsonObject(
  value:
    | Prisma.JsonValue
    | null,
): JsonRecord {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return {
      ...value,
    };
  }

  return {};
}

function readMetadataText(
  metadata:
    | Record<string, unknown>
    | null,
  key:
    keyof SubscriptionWebhookMetadata,
): string | null {
  if (!metadata) {
    return null;
  }

  const value =
    metadata[key];

  return typeof value ===
    "string"
    ? value.trim() || null
    : null;
}

function readNestedRecord(
  record: JsonRecord,
  keys: readonly string[],
): JsonRecord | null {
  for (
    const key of keys
  ) {
    const value =
      record[key];

    if (
      isRecord(value)
    ) {
      return value;
    }
  }

  return null;
}

function readFirstString(
  record:
    | JsonRecord
    | null,
  keys: readonly string[],
): string | null {
  if (!record) {
    return null;
  }

  for (
    const key of keys
  ) {
    const value =
      normalizeText(
        record[key],
      );

    if (value) {
      return value;
    }
  }

  return null;
}

function parsePayload(
  rawBody: string,
): JsonRecord {
  if (
    !rawBody.trim()
  ) {
    throw new SubscriptionPaymentWebhookError({
      code:
        "SUBSCRIPTION_WEBHOOK_BODY_EMPTY",
      message:
        "Le corps du webhook Moneroo est vide.",
      status: 400,
    });
  }

  let parsed: unknown;

  try {
    parsed =
      JSON.parse(
        rawBody,
      ) as unknown;
  } catch (error) {
    throw new SubscriptionPaymentWebhookError({
      code:
        "SUBSCRIPTION_WEBHOOK_JSON_INVALID",
      message:
        "Le corps du webhook Moneroo n’est pas un JSON valide.",
      status: 400,
      cause: error,
    });
  }

  if (
    !isRecord(parsed)
  ) {
    throw new SubscriptionPaymentWebhookError({
      code:
        "SUBSCRIPTION_WEBHOOK_PAYLOAD_INVALID",
      message:
        "Le contenu du webhook Moneroo est invalide.",
      status: 400,
    });
  }

  return parsed;
}

function extractProviderTransactionId(
  payload: JsonRecord,
): string | null {
  const data =
    readNestedRecord(
      payload,
      [
        "data",
        "payment",
        "object",
        "resource",
      ],
    );

  const nestedPayment =
    data
      ? readNestedRecord(
          data,
          [
            "payment",
            "object",
            "resource",
          ],
        )
      : null;

  return (
    readFirstString(
      data,
      [
        "payment_id",
        "paymentId",
        "transaction_id",
        "transactionId",
        "id",
      ],
    ) ??
    readFirstString(
      nestedPayment,
      [
        "payment_id",
        "paymentId",
        "transaction_id",
        "transactionId",
        "id",
      ],
    ) ??
    readFirstString(
      payload,
      [
        "payment_id",
        "paymentId",
        "transaction_id",
        "transactionId",
      ],
    )
  );
}

function getVerifiedPaidAt(
  verified:
    MonerooPaymentResult,
): Date {
  const processedAt =
    normalizeText(
      verified.processedAt,
    );

  if (processedAt) {
    const parsed =
      new Date(
        processedAt,
      );

    if (
      !Number.isNaN(
        parsed.getTime(),
      )
    ) {
      return parsed;
    }
  }

  return new Date();
}

function getFailureReason(
  verified:
    MonerooPaymentResult,
): string | null {
  switch (
    verified.status
  ) {
    case PaymentStatus.FAILED:
      return "Le paiement Moneroo de l’abonnement Premium a échoué.";

    case PaymentStatus.REFUNDED:
      return "Le paiement Moneroo de l’abonnement Premium a été remboursé.";

    default:
      return null;
  }
}

function assertVerifiedMetadata(
  verified:
    MonerooPaymentResult,
): {
  paymentId: string;
  subscriptionId: string;
  organizerId: string;
  planId: string;
} {
  const metadata =
    verified.metadata;

  const source =
    normalizeUpperText(
      readMetadataText(
        metadata,
        "source",
      ),
    );

  const type =
    normalizeUpperText(
      readMetadataText(
        metadata,
        "type",
      ),
    );

  if (
    source !== "TIKEMIA" ||
    type !==
      "ORGANIZER_SUBSCRIPTION"
  ) {
    throw new SubscriptionPaymentWebhookError({
      code:
        "SUBSCRIPTION_WEBHOOK_METADATA_INVALID",
      message:
        "Le paiement Moneroo ne correspond pas à un abonnement Premium Tikemia.",
      status: 409,
    });
  }

  const paymentId =
    readMetadataText(
      metadata,
      "paymentId",
    );

  const subscriptionId =
    readMetadataText(
      metadata,
      "subscriptionId",
    );

  const organizerId =
    readMetadataText(
      metadata,
      "organizerId",
    );

  const planId =
    readMetadataText(
      metadata,
      "planId",
    );

  if (
    !paymentId ||
    !subscriptionId ||
    !organizerId ||
    !planId
  ) {
    throw new SubscriptionPaymentWebhookError({
      code:
        "SUBSCRIPTION_WEBHOOK_METADATA_INCOMPLETE",
      message:
        "Les métadonnées du paiement Moneroo sont incomplètes.",
      status: 409,
      paymentId,
      subscriptionId,
    });
  }

  return {
    paymentId,
    subscriptionId,
    organizerId,
    planId,
  };
}

function assertAmountAndCurrency({
  verified,
  amount,
  currency,
  paymentId,
  subscriptionId,
}: {
  verified:
    MonerooPaymentResult;
  amount:
    Prisma.Decimal;
  currency:
    string;
  paymentId:
    string;
  subscriptionId:
    string;
}): void {
  const expectedCurrency =
    normalizeUpperText(
      currency,
    );

  const verifiedCurrency =
    normalizeUpperText(
      verified.currency,
    );

  if (
    expectedCurrency !==
    verifiedCurrency
  ) {
    throw new SubscriptionPaymentWebhookError({
      code:
        "SUBSCRIPTION_PAYMENT_CURRENCY_MISMATCH",
      message:
        "La devise confirmée par Moneroo ne correspond pas à celle de l’abonnement.",
      status: 409,
      paymentId,
      subscriptionId,
    });
  }

  const verifiedAmount =
    new Prisma.Decimal(
      verified.amount,
    );

  if (
    !amount.equals(
      verifiedAmount,
    )
  ) {
    throw new SubscriptionPaymentWebhookError({
      code:
        "SUBSCRIPTION_PAYMENT_AMOUNT_MISMATCH",
      message:
        "Le montant confirmé par Moneroo ne correspond pas au prix de l’abonnement.",
      status: 409,
      paymentId,
      subscriptionId,
    });
  }
}

function assertPaymentIdentity({
  verified,
  payment,
  metadataIds,
}: {
  verified:
    MonerooPaymentResult;
  payment: {
    id: string;
    subscriptionId: string;
    organizerId: string;
    provider: string;
    providerReference:
      | string
      | null;
    metadata:
      | Prisma.JsonValue
      | null;
    subscription: {
      planId: string;
    };
  };
  metadataIds: {
    paymentId: string;
    subscriptionId: string;
    organizerId: string;
    planId: string;
  };
}): void {
  if (
    payment.id !==
      metadataIds.paymentId ||
    payment.subscriptionId !==
      metadataIds.subscriptionId ||
    payment.organizerId !==
      metadataIds.organizerId ||
    payment.subscription.planId !==
      metadataIds.planId
  ) {
    throw new SubscriptionPaymentWebhookError({
      code:
        "SUBSCRIPTION_PAYMENT_IDENTITY_MISMATCH",
      message:
        "Le paiement Moneroo ne correspond pas à l’abonnement enregistré.",
      status: 409,
      paymentId:
        payment.id,
      subscriptionId:
        payment.subscriptionId,
    });
  }

  if (
    normalizeUpperText(
      payment.provider,
    ) !==
    MONEROO_PROVIDER
  ) {
    throw new SubscriptionPaymentWebhookError({
      code:
        "SUBSCRIPTION_PAYMENT_PROVIDER_MISMATCH",
      message:
        "Ce paiement d’abonnement n’est pas associé à Moneroo.",
      status: 409,
      paymentId:
        payment.id,
      subscriptionId:
        payment.subscriptionId,
    });
  }

  const storedProviderTransactionId =
    normalizeText(
      readJsonObject(
        payment.metadata,
      )
        .providerTransactionId,
    );

  if (
    storedProviderTransactionId &&
    storedProviderTransactionId !==
      verified.providerTransactionId
  ) {
    throw new SubscriptionPaymentWebhookError({
      code:
        "SUBSCRIPTION_PAYMENT_TRANSACTION_MISMATCH",
      message:
        "L’identifiant de transaction Moneroo ne correspond pas au paiement enregistré.",
      status: 409,
      paymentId:
        payment.id,
      subscriptionId:
        payment.subscriptionId,
    });
  }

  if (
    payment.providerReference &&
    verified.providerReference &&
    payment.providerReference !==
      verified.providerReference
  ) {
    throw new SubscriptionPaymentWebhookError({
      code:
        "SUBSCRIPTION_PAYMENT_REFERENCE_MISMATCH",
      message:
        "La référence Moneroo ne correspond pas au paiement enregistré.",
      status: 409,
      paymentId:
        payment.id,
      subscriptionId:
        payment.subscriptionId,
    });
  }
}

async function persistVerifiedStatus({
  paymentId,
  verified,
  paidAt,
}: {
  paymentId: string;
  verified:
    MonerooPaymentResult;
  paidAt: Date;
}): Promise<void> {
  await prisma.$transaction(
    async (
      transaction,
    ) => {
      const payment =
        await transaction
          .subscriptionPayment
          .findUnique({
            where: {
              id: paymentId,
            },
            select: {
              id: true,
              status: true,
              paidAt: true,
              providerReference:
                true,
              metadata: true,
            },
          });

      if (!payment) {
        throw new SubscriptionPaymentWebhookError({
          code:
            "SUBSCRIPTION_PAYMENT_NOT_FOUND",
          message:
            "Le paiement de l’abonnement Premium est introuvable.",
          status: 404,
          paymentId,
        });
      }

      /*
       * Un paiement déjà confirmé ne doit jamais être rétrogradé par un
       * webhook tardif PENDING ou FAILED.
       */
      if (
        payment.status ===
          PaymentStatus.SUCCESS &&
        verified.status !==
          PaymentStatus.SUCCESS
      ) {
        return;
      }

      const previousMetadata =
        readJsonObject(
          payment.metadata,
        );

      await transaction
        .subscriptionPayment
        .update({
          where: {
            id:
              payment.id,
          },
          data: {
            provider:
              MONEROO_PROVIDER,
            providerReference:
              verified.providerReference ??
              payment.providerReference,
            status:
              verified.status,
            paidAt:
              verified.status ===
              PaymentStatus.SUCCESS
                ? payment.paidAt ??
                  paidAt
                : payment.paidAt,
            failureReason:
              getFailureReason(
                verified,
              ),
            metadata:
              toJsonValue({
                ...previousMetadata,
                providerTransactionId:
                  verified
                    .providerTransactionId,
                providerRawStatus:
                  verified.rawStatus,
                providerProcessed:
                  verified.isProcessed,
                providerProcessedAt:
                  verified.processedAt,
                gateway:
                  verified.gateway,
                paymentMethod:
                  verified.paymentMethod,
                verifiedAt:
                  new Date()
                    .toISOString(),
                providerRaw:
                  verified.raw,
              }),
          },
        });
    },
    {
      isolationLevel:
        Prisma
          .TransactionIsolationLevel
          .Serializable,
      maxWait:
        10_000,
      timeout:
        20_000,
    },
  );
}

export async function processSubscriptionPaymentWebhook(
  input:
    ProcessSubscriptionPaymentWebhookInput,
): Promise<ProcessSubscriptionPaymentWebhookResult> {
  /*
   * La signature est vérifiée avant tout parsing métier et avant toute
   * écriture en base, comme sur le webhook Moneroo des paiements billets.
   */
  assertValidMonerooWebhookSignature(
    input.rawBody,
    input.signature,
  );

  const payload =
    parsePayload(
      input.rawBody,
    );

  const providerTransactionId =
    extractProviderTransactionId(
      payload,
    );

  if (
    !providerTransactionId
  ) {
    throw new SubscriptionPaymentWebhookError({
      code:
        "SUBSCRIPTION_WEBHOOK_PAYMENT_ID_MISSING",
      message:
        "L’identifiant du paiement Moneroo est absent du webhook.",
      status: 400,
    });
  }

  let localPaymentId:
    | string
    | null = null;

  let localSubscriptionId:
    | string
    | null = null;

  try {
    /*
     * On ne fait jamais confiance au seul contenu du webhook pour confirmer
     * le paiement : l’état réel est relu directement chez Moneroo.
     */
    const verified =
      await monerooProvider
        .verifyPayment(
          providerTransactionId,
          {
            signal:
              input.signal,
          },
        );

    if (
      verified.provider !==
        MONEROO_PROVIDER
    ) {
      throw new SubscriptionPaymentWebhookError({
        code:
          "SUBSCRIPTION_PAYMENT_PROVIDER_MISMATCH",
        message:
          "Le prestataire de paiement confirmé est invalide.",
        status: 409,
      });
    }

    if (
      verified.providerTransactionId !==
      providerTransactionId
    ) {
      throw new SubscriptionPaymentWebhookError({
        code:
          "SUBSCRIPTION_PAYMENT_TRANSACTION_MISMATCH",
        message:
          "La transaction vérifiée par Moneroo ne correspond pas au webhook reçu.",
        status: 409,
      });
    }

    const metadataIds =
      assertVerifiedMetadata(
        verified,
      );

    localPaymentId =
      metadataIds.paymentId;
    localSubscriptionId =
      metadataIds.subscriptionId;

    const payment =
      await prisma.subscriptionPayment
        .findUnique({
          where: {
            id:
              metadataIds.paymentId,
          },
          select: {
            id: true,
            subscriptionId: true,
            organizerId: true,
            amount: true,
            currency: true,
            provider: true,
            providerReference:
              true,
            status: true,
            paidAt: true,
            metadata: true,
            subscription: {
              select: {
                id: true,
                organizerId: true,
                planId: true,
                status: true,
              },
            },
          },
        });

    if (!payment) {
      throw new SubscriptionPaymentWebhookError({
        code:
          "SUBSCRIPTION_PAYMENT_NOT_FOUND",
        message:
          "Le paiement de l’abonnement Premium est introuvable.",
        status: 404,
        paymentId:
          metadataIds.paymentId,
        subscriptionId:
          metadataIds.subscriptionId,
      });
    }

    assertPaymentIdentity({
      verified,
      payment,
      metadataIds,
    });

    /*
     * Le montant et la devise de SubscriptionPayment sont le snapshot
     * immuable du checkout. On ne recompare pas ici le prix courant du plan :
     * un administrateur peut modifier une formule après l'ouverture du
     * checkout sans invalider rétroactivement un paiement légitime.
     */
    assertAmountAndCurrency({
      verified,
      amount:
        payment.amount,
      currency:
        payment.currency,
      paymentId:
        payment.id,
      subscriptionId:
        payment.subscriptionId,
    });

    const alreadyCompleted =
      payment.status ===
        PaymentStatus.SUCCESS &&
      payment.subscription.status ===
        SubscriptionStatus.ACTIVE;

    if (
      alreadyCompleted
    ) {
      return Object.freeze({
        paymentId:
          payment.id,
        subscriptionId:
          payment.subscriptionId,
        organizerId:
          payment.organizerId,
        providerTransactionId:
          verified
            .providerTransactionId,
        providerReference:
          verified
            .providerReference,
        paymentStatus:
          PaymentStatus.SUCCESS,
        subscriptionStatus:
          SubscriptionStatus.ACTIVE,
        duplicate: true,
        activated: false,
        activation: null,
      });
    }

    const paidAt =
      getVerifiedPaidAt(
        verified,
      );

    await persistVerifiedStatus({
      paymentId:
        payment.id,
      verified,
      paidAt,
    });

    /*
     * PENDING est l’état intermédiaire du modèle SubscriptionPayment.
     * On le persiste mais on n’active surtout pas l’abonnement.
     */
    if (
      verified.status ===
        PaymentStatus.PENDING
    ) {
      return Object.freeze({
        paymentId:
          payment.id,
        subscriptionId:
          payment.subscriptionId,
        organizerId:
          payment.organizerId,
        providerTransactionId:
          verified
            .providerTransactionId,
        providerReference:
          verified
            .providerReference,
        paymentStatus:
          verified.status,
        subscriptionStatus:
          payment.subscription
            .status,
        duplicate: false,
        activated: false,
        activation: null,
      });
    }

    /*
     * Tous les états terminaux non-success restent enregistrés sur le
     * paiement, mais n'activent jamais la formule Premium.
     */
    if (
      verified.status !==
      PaymentStatus.SUCCESS
    ) {
      return Object.freeze({
        paymentId:
          payment.id,
        subscriptionId:
          payment.subscriptionId,
        organizerId:
          payment.organizerId,
        providerTransactionId:
          verified
            .providerTransactionId,
        providerReference:
          verified
            .providerReference,
        paymentStatus:
          verified.status,
        subscriptionStatus:
          payment.subscription
            .status,
        duplicate: false,
        activated: false,
        activation: null,
      });
    }

    /*
     * Une confirmation SUCCESS doit être réellement traitée par Moneroo.
     * Cela évite d'activer une formule sur un état incohérent du fournisseur.
     */
    if (
      !verified.isProcessed
    ) {
      throw new SubscriptionPaymentWebhookError({
        code:
          "SUBSCRIPTION_PAYMENT_NOT_PROCESSED",
        message:
          "Moneroo indique un paiement réussi mais non encore traité.",
        status: 409,
        paymentId:
          payment.id,
        subscriptionId:
          payment.subscriptionId,
      });
    }

    const activation =
      await activateOrganizerSubscription({
        organizerId:
          payment.organizerId,
        input: {
          subscriptionId:
            payment.subscriptionId,
          paymentId:
            payment.id,
          providerReference:
            verified.providerReference ??
            undefined,
          paidAt,
          metadata: {
            source:
              "MONEROO_WEBHOOK",
            provider:
              MONEROO_PROVIDER,
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
              verified.paymentMethod,
            processedAt:
              verified.processedAt,
          },
        },
      });

    return Object.freeze({
      paymentId:
        payment.id,
      subscriptionId:
        payment.subscriptionId,
      organizerId:
        payment.organizerId,
      providerTransactionId:
        verified
          .providerTransactionId,
      providerReference:
        verified
          .providerReference,
      paymentStatus:
        PaymentStatus.SUCCESS,
      subscriptionStatus:
        activation.subscription
          .status,
      duplicate: false,
      activated:
        activation.subscription
          .status ===
        SubscriptionStatus.ACTIVE,
      activation,
    });
  } catch (error) {
    if (
      error instanceof
      SubscriptionPaymentWebhookError
    ) {
      throw error;
    }

    const paymentError =
      getPaymentError(
        error,
        {
          code:
            "PAYMENT_WEBHOOK_INVALID",
          message:
            "Impossible de traiter le webhook Moneroo de l’abonnement Premium.",
          status: 500,
          exposeMessage:
            false,
          provider:
            MONEROO_PROVIDER,
          paymentId:
            localPaymentId,
          details: {
            subscriptionId:
              localSubscriptionId,
            providerTransactionId,
          },
        },
      );

    console.error(
      "[ORGANIZER_SUBSCRIPTION_PAYMENT_WEBHOOK_ERROR]",
      getPaymentErrorLogContext(
        paymentError,
      ),
    );

    throw new SubscriptionPaymentWebhookError({
      code:
        "SUBSCRIPTION_WEBHOOK_PROCESSING_FAILED",
      message:
        "Impossible de traiter le webhook Moneroo de l’abonnement Premium.",
      status:
        paymentError.status,
      paymentId:
        localPaymentId,
      subscriptionId:
        localSubscriptionId,
      cause:
        paymentError,
    });
  }
}