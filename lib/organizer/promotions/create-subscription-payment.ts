import "server-only";

import {
  PaymentStatus,
  Prisma,
  SubscriptionStatus,
} from "@prisma/client";

import { createPayment } from "@/lib/payments/create-payment";
import {
  PaymentError,
  PaymentValidationError,
  getPaymentError,
  getPaymentErrorLogContext,
} from "@/lib/payments/payment-errors";
import { getDefaultPaymentProviderName } from "@/lib/payments/provider-router";
import type {
  PaymentMetadata,
  PaymentProviderName,
} from "@/lib/payments/payment-provider-types";
import { prisma } from "@/lib/prisma";

const DEFAULT_PROVIDER = "MONEROO";

type SubscriptionPaymentMetadata = {
  source?: unknown;
  type?: unknown;
  subscriptionId?: unknown;
  organizerId?: unknown;
  planId?: unknown;
  planCode?: unknown;
  planName?: unknown;
  providerTransactionId?: unknown;
  checkoutUrl?: unknown;
  returnUrl?: unknown;
  cancelUrl?: unknown;
  idempotencyKey?: unknown;
  providerRawStatus?: unknown;
};

export type CreateSubscriptionPaymentInput = Readonly<{
  organizerId: string;
  subscriptionId: string;
  signal?: AbortSignal;
}>;

export type CreateSubscriptionPaymentResult = Readonly<{
  paymentId: string;
  subscriptionId: string;
  provider: PaymentProviderName;
  providerTransactionId: string | null;
  providerReference: string | null;
  checkoutUrl: string;
  returnUrl: string;
  cancelUrl: string;
  amount: string;
  currency: string;
  status: PaymentStatus;
  alreadyPrepared: boolean;
}>;

function normalizeText(
  value: string | null | undefined,
): string {
  return value?.trim() ?? "";
}

function normalizeUpperText(
  value: string | null | undefined,
): string {
  return normalizeText(value).toUpperCase();
}

function toJsonValue(
  value: unknown,
): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(value),
  ) as Prisma.InputJsonValue;
}

function readJsonObject(
  value: Prisma.JsonValue | null,
): Record<string, unknown> {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return { ...value };
  }

  return {};
}

function readMetadataText(
  metadata: Prisma.JsonValue | null,
  key: keyof SubscriptionPaymentMetadata,
): string | null {
  const object = readJsonObject(metadata);
  const value = object[key];

  return typeof value === "string"
    ? value.trim() || null
    : null;
}

function getApplicationBaseUrl(): string {
  const candidate =
    normalizeText(
      process.env.NEXT_PUBLIC_APP_URL,
    ) ||
    normalizeText(process.env.APP_URL);

  if (!candidate) {
    throw new PaymentError({
      code: "PAYMENT_CONFIGURATION_ERROR",
      message:
        "L’URL publique de Tikemia n’est pas configurée.",
      status: 500,
    });
  }

  let url: URL;

  try {
    url = new URL(candidate);
  } catch {
    throw new PaymentError({
      code: "PAYMENT_CONFIGURATION_ERROR",
      message:
        "L’URL publique de Tikemia est invalide.",
      status: 500,
    });
  }

  if (
    process.env.NODE_ENV === "production" &&
    url.protocol !== "https:"
  ) {
    throw new PaymentError({
      code: "PAYMENT_CONFIGURATION_ERROR",
      message:
        "L’URL publique de Tikemia doit utiliser HTTPS en production.",
      status: 500,
    });
  }

  return url.toString();
}

function buildCheckoutReturnUrl({
  subscriptionId,
  paymentId,
  state,
}: {
  subscriptionId: string;
  paymentId: string;
  state: "return" | "cancelled";
}): string {
  const url = new URL(
    "/organizer/promotions/checkout",
    getApplicationBaseUrl(),
  );

  url.searchParams.set(
    "subscriptionId",
    subscriptionId,
  );
  url.searchParams.set(
    "paymentId",
    paymentId,
  );
  url.searchParams.set(
    "payment",
    state,
  );

  return url.toString();
}

function buildIdempotencyKey({
  provider,
  subscriptionId,
}: {
  provider: PaymentProviderName;
  subscriptionId: string;
}): string {
  return `subscription_${provider.toLowerCase()}_${subscriptionId}`;
}

function decimalToProviderAmount(
  amount: Prisma.Decimal,
  currency: string,
): number {
  const normalizedCurrency =
    normalizeUpperText(currency);

  if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
    throw new PaymentValidationError({
      code: "PAYMENT_CURRENCY_MISMATCH",
      message:
        "La devise de la formule Premium est invalide.",
      status: 409,
      details: {
        currency: normalizedCurrency,
      },
    });
  }

  /*
   * Le moteur de paiement partagé par Tikemia attend actuellement un
   * montant entier positif. Cette validation reprend exactement la
   * contrainte déjà appliquée au paiement des billets.
   */
  const numericAmount = amount.toNumber();

  if (
    amount.decimalPlaces() > 0 ||
    !Number.isSafeInteger(numericAmount) ||
    numericAmount <= 0
  ) {
    throw new PaymentValidationError({
      code: "PAYMENT_AMOUNT_MISMATCH",
      message:
        "Le montant de cette formule Premium ne peut pas être envoyé au prestataire.",
      status: 409,
      details: {
        amount: amount.toFixed(2),
        currency: normalizedCurrency,
      },
    });
  }

  return numericAmount;
}

function splitOrganizerName({
  firstName,
  lastName,
}: {
  firstName: string;
  lastName: string;
}): {
  firstName: string;
  lastName: string;
} {
  return {
    firstName:
      normalizeText(firstName) ||
      "Organisateur",
    lastName:
      normalizeText(lastName) ||
      "Tikemia",
  };
}

function buildProviderMetadata({
  paymentId,
  subscriptionId,
  organizerId,
  planId,
  planCode,
  provider,
  currency,
}: {
  paymentId: string;
  subscriptionId: string;
  organizerId: string;
  planId: string;
  planCode: string;
  provider: PaymentProviderName;
  currency: string;
}): PaymentMetadata {
  return {
    source: "TIKEMIA",
    type: "ORGANIZER_SUBSCRIPTION",
    paymentId,
    subscriptionId,
    organizerId,
    planId,
    planCode,
    currency,
    selectedProvider: provider,
  };
}

async function markSubscriptionPaymentFailed({
  paymentId,
  error,
}: {
  paymentId: string;
  error: PaymentError;
}): Promise<void> {
  await prisma.subscriptionPayment
    .updateMany({
      where: {
        id: paymentId,
        status: PaymentStatus.PENDING,
      },
      data: {
        status: PaymentStatus.FAILED,
        failureReason:
          error.exposeMessage
            ? error.message
            : "Le prestataire de paiement n’a pas pu préparer la transaction.",
      },
    })
    .catch((persistenceError) => {
      console.error(
        "[SUBSCRIPTION_PAYMENT_FAILURE_PERSIST_ERROR]",
        getPaymentErrorLogContext(
          persistenceError,
        ),
      );
    });
}

export async function createSubscriptionPayment({
  organizerId,
  subscriptionId,
  signal,
}: CreateSubscriptionPaymentInput): Promise<CreateSubscriptionPaymentResult> {
  const normalizedOrganizerId =
    normalizeText(organizerId);

  const normalizedSubscriptionId =
    normalizeText(subscriptionId);

  if (
    !normalizedOrganizerId ||
    !normalizedSubscriptionId
  ) {
    throw new PaymentValidationError({
      code: "PAYMENT_INVALID_REQUEST",
      message:
        "L’organisateur et l’abonnement Premium sont obligatoires.",
      status: 400,
    });
  }

  const selectedProvider =
    getDefaultPaymentProviderName() ||
    DEFAULT_PROVIDER;

  let paymentId: string | null = null;

  try {
    const subscription =
      await prisma.organizerSubscription.findFirst({
        where: {
          id: normalizedSubscriptionId,
          organizerId:
            normalizedOrganizerId,
        },
        select: {
          id: true,
          organizerId: true,
          planId: true,
          status: true,
          createdAt: true,
          plan: {
            select: {
              id: true,
              code: true,
              name: true,
              price: true,
              currency: true,
              isActive: true,
              isPublic: true,
            },
          },
          organizer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              countryCode: true,
              emailVerified: true,
              isActive: true,
            },
          },
          payments: {
            orderBy: [
              {
                createdAt: "desc",
              },
              {
                id: "desc",
              },
            ],
            take: 1,
            select: {
              id: true,
              amount: true,
              currency: true,
              provider: true,
              providerReference: true,
              status: true,
              metadata: true,
              createdAt: true,
            },
          },
        },
      });

    if (!subscription) {
      throw new PaymentValidationError({
        code: "PAYMENT_ORDER_NOT_FOUND",
        message:
          "La demande de souscription Premium est introuvable.",
        status: 404,
        details: {
          subscriptionId:
            normalizedSubscriptionId,
        },
      });
    }

    if (
      !subscription.organizer.isActive ||
      !subscription.organizer.emailVerified
    ) {
      throw new PaymentValidationError({
        code: "PAYMENT_FORBIDDEN",
        message:
          "Votre compte organisateur ne peut pas effectuer ce paiement.",
        status: 403,
      });
    }

    if (
      !subscription.plan.isActive ||
      !subscription.plan.isPublic
    ) {
      throw new PaymentValidationError({
        code: "PAYMENT_ORDER_NOT_PAYABLE",
        message:
          "Cette formule Premium n’est plus disponible.",
        status: 409,
        details: {
          planId: subscription.plan.id,
        },
      });
    }

    if (
      subscription.status ===
      SubscriptionStatus.ACTIVE
    ) {
      throw new PaymentValidationError({
        code: "PAYMENT_ORDER_ALREADY_PAID",
        message:
          "Cet abonnement Premium est déjà actif.",
        status: 409,
        details: {
          subscriptionId:
            subscription.id,
        },
      });
    }

    if (
      subscription.status !==
      SubscriptionStatus.PENDING
    ) {
      throw new PaymentValidationError({
        code: "PAYMENT_ORDER_NOT_PAYABLE",
        message:
          "Cet abonnement Premium ne peut plus être payé.",
        status: 409,
        details: {
          subscriptionId:
            subscription.id,
          subscriptionStatus:
            subscription.status,
        },
      });
    }

    const currency =
      normalizeUpperText(
        subscription.plan.currency,
      );

    const providerAmount =
      decimalToProviderAmount(
        subscription.plan.price,
        currency,
      );

    const latestPayment =
      subscription.payments[0] ??
      null;

    if (
      latestPayment?.status ===
      PaymentStatus.SUCCESS
    ) {
      throw new PaymentValidationError({
        code: "PAYMENT_ORDER_ALREADY_PAID",
        message:
          "Le paiement de cet abonnement Premium est déjà confirmé.",
        status: 409,
        paymentId: latestPayment.id,
        details: {
          subscriptionId:
            subscription.id,
        },
      });
    }

    /*
     * Si un checkout déjà préparé existe pour la même souscription, le
     * même prestataire et exactement le même montant/devise, on le
     * réutilise. Le checkout URL et l'identifiant de transaction sont
     * conservés dans metadata car SubscriptionPayment est volontairement
     * plus léger que le modèle Payment utilisé pour les billets.
     */
    if (
      latestPayment &&
      latestPayment.status ===
        PaymentStatus.PENDING &&
      normalizeUpperText(
        latestPayment.provider,
      ) === selectedProvider &&
      latestPayment.amount.equals(
        subscription.plan.price,
      ) &&
      normalizeUpperText(
        latestPayment.currency,
      ) === currency
    ) {
      const existingCheckoutUrl =
        readMetadataText(
          latestPayment.metadata,
          "checkoutUrl",
        );

      if (existingCheckoutUrl) {
        const returnUrl =
          readMetadataText(
            latestPayment.metadata,
            "returnUrl",
          ) ??
          buildCheckoutReturnUrl({
            subscriptionId:
              subscription.id,
            paymentId:
              latestPayment.id,
            state: "return",
          });

        const cancelUrl =
          readMetadataText(
            latestPayment.metadata,
            "cancelUrl",
          ) ??
          buildCheckoutReturnUrl({
            subscriptionId:
              subscription.id,
            paymentId:
              latestPayment.id,
            state: "cancelled",
          });

        return Object.freeze({
          paymentId:
            latestPayment.id,
          subscriptionId:
            subscription.id,
          provider:
            selectedProvider,
          providerTransactionId:
            readMetadataText(
              latestPayment.metadata,
              "providerTransactionId",
            ),
          providerReference:
            latestPayment.providerReference,
          checkoutUrl:
            existingCheckoutUrl,
          returnUrl,
          cancelUrl,
          amount:
            latestPayment.amount.toFixed(2),
          currency:
            latestPayment.currency,
          status:
            latestPayment.status,
          alreadyPrepared: true,
        });
      }
    }

    const prepared =
      await prisma.$transaction(
        async (transaction) => {
          /*
           * Un seul paiement de travail est conservé pour la souscription.
           * Une ancienne tentative FAILED ou REFUNDED peut être
           * recyclée ; sinon on crée un nouvel enregistrement.
           */
          if (
            latestPayment &&
            latestPayment.status !==
              PaymentStatus.SUCCESS
          ) {
            const updatedPayment =
              await transaction.subscriptionPayment.update({
                where: {
                  id: latestPayment.id,
                },
                data: {
                  amount:
                    subscription.plan.price,
                  currency,
                  provider:
                    selectedProvider,
                  providerReference: null,
                  status:
                    PaymentStatus.PENDING,
                  failureReason: null,
                  paidAt: null,
                  metadata:
                    toJsonValue({
                      source: "TIKEMIA",
                      type:
                        "ORGANIZER_SUBSCRIPTION",
                      subscriptionId:
                        subscription.id,
                      organizerId:
                        subscription.organizerId,
                      planId:
                        subscription.plan.id,
                      planCode:
                        subscription.plan.code,
                      planName:
                        subscription.plan.name,
                    }),
                },
                select: {
                  id: true,
                },
              });

            return updatedPayment;
          }

          return transaction.subscriptionPayment.create({
            data: {
              subscriptionId:
                subscription.id,
              organizerId:
                subscription.organizerId,
              amount:
                subscription.plan.price,
              currency,
              provider:
                selectedProvider,
              status:
                PaymentStatus.PENDING,
              metadata:
                toJsonValue({
                  source: "TIKEMIA",
                  type:
                    "ORGANIZER_SUBSCRIPTION",
                  subscriptionId:
                    subscription.id,
                  organizerId:
                    subscription.organizerId,
                  planId:
                    subscription.plan.id,
                  planCode:
                    subscription.plan.code,
                  planName:
                    subscription.plan.name,
                }),
            },
            select: {
              id: true,
            },
          });
        },
        {
          isolationLevel:
            Prisma.TransactionIsolationLevel
              .Serializable,
          maxWait: 10_000,
          timeout: 20_000,
        },
      );

    paymentId = prepared.id;

    const returnUrl =
      buildCheckoutReturnUrl({
        subscriptionId:
          subscription.id,
        paymentId,
        state: "return",
      });

    const cancelUrl =
      buildCheckoutReturnUrl({
        subscriptionId:
          subscription.id,
        paymentId,
        state: "cancelled",
      });

    const idempotencyKey =
      buildIdempotencyKey({
        provider:
          selectedProvider,
        subscriptionId:
          subscription.id,
      });

    const providerMetadata =
      buildProviderMetadata({
        paymentId,
        subscriptionId:
          subscription.id,
        organizerId:
          subscription.organizerId,
        planId:
          subscription.plan.id,
        planCode:
          subscription.plan.code,
        provider:
          selectedProvider,
        currency,
      });

    const organizerName =
      splitOrganizerName({
        firstName:
          subscription.organizer.firstName,
        lastName:
          subscription.organizer.lastName,
      });

    const hostedCheckout =
      await createPayment({
        provider:
          selectedProvider,
        amount:
          providerAmount,
        currency,
        description:
          `Abonnement Tikemia Premium — ${subscription.plan.name}`,
        returnUrl,
        customer: {
          email:
            subscription.organizer.email,
          firstName:
            organizerName.firstName,
          lastName:
            organizerName.lastName,
          phone:
            subscription.organizer.phone,
          countryCode:
            subscription.organizer.countryCode,
        },
        metadata:
          providerMetadata,
        idempotencyKey,
        signal,
      });

    await prisma.subscriptionPayment.update({
      where: {
        id: paymentId,
      },
      data: {
        provider:
          hostedCheckout.provider,
        providerReference:
          hostedCheckout.providerReference,
        status:
          hostedCheckout.status,
        failureReason: null,
        metadata:
          toJsonValue({
            ...providerMetadata,
            planName:
              subscription.plan.name,
            providerTransactionId:
              hostedCheckout.providerTransactionId,
            checkoutUrl:
              hostedCheckout.checkoutUrl,
            returnUrl,
            cancelUrl,
            idempotencyKey,
            providerRawStatus:
              hostedCheckout.rawStatus,
            providerRaw:
              hostedCheckout.raw,
          }),
      },
    });

    return Object.freeze({
      paymentId,
      subscriptionId:
        subscription.id,
      provider:
        hostedCheckout.provider,
      providerTransactionId:
        hostedCheckout.providerTransactionId,
      providerReference:
        hostedCheckout.providerReference,
      checkoutUrl:
        hostedCheckout.checkoutUrl,
      returnUrl,
      cancelUrl,
      amount:
        subscription.plan.price.toFixed(2),
      currency,
      status:
        hostedCheckout.status,
      alreadyPrepared: false,
    });
  } catch (error) {
    const paymentError =
      getPaymentError(error, {
        code:
          "PAYMENT_INTERNAL_ERROR",
        message:
          "Impossible de préparer le paiement de l’abonnement Premium pour le moment.",
        status: 500,
        exposeMessage: false,
        provider:
          selectedProvider,
        paymentId,
        details: {
          subscriptionId:
            normalizedSubscriptionId,
          organizerId:
            normalizedOrganizerId,
        },
      });

    console.error(
      "[ORGANIZER_SUBSCRIPTION_PAYMENT_CREATE_ERROR]",
      getPaymentErrorLogContext(
        paymentError,
      ),
    );

    if (paymentId) {
      await markSubscriptionPaymentFailed({
        paymentId,
        error: paymentError,
      });
    }

    throw paymentError;
  }
}