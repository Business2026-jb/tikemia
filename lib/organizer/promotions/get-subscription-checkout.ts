import "server-only";

import {
  createHash,
} from "node:crypto";

import {
  PaymentStatus,
  Prisma,
  SubscriptionStatus,
  UserRole,
} from "@prisma/client";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";

const SESSION_COOKIE_FALLBACK_NAME =
  "tikemia_session";

type CheckoutFeature = Readonly<{
  key: string;
  label: string;
  description: string | null;
  included: boolean;
}>;

export type OrganizerSubscriptionCheckoutPlan =
  Readonly<{
    id: string;
    code: string;
    name: string;
    description: string | null;
    price: number;
    priceFormatted: string;
    currency: string;
    billingPeriod: string;
    durationDays: number;
    maxBoostedEvents: number;
    priorityScore: number;
    features: CheckoutFeature[];
    isActive: boolean;
    isPublic: boolean;
  }>;

export type OrganizerSubscriptionCheckoutPayment =
  Readonly<{
    id: string;
    amount: number;
    amountFormatted: string;
    currency: string;
    provider: string;
    providerReference: string | null;
    providerTransactionId: string | null;
    checkoutUrl: string | null;
    returnUrl: string | null;
    cancelUrl: string | null;
    status: PaymentStatus;
    failureReason: string | null;
    paidAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>;

export type OrganizerSubscriptionCheckout =
  Readonly<{
    organizer: {
      id: string;
      firstName: string;
      lastName: string;
      displayName: string;
      email: string;
      hasBlueBadge: boolean;
    };

    subscription: {
      id: string;
      organizerId: string;
      planId: string;
      status: SubscriptionStatus;
      startsAt: string | null;
      endsAt: string | null;
      trialEndsAt: string | null;
      autoRenew: boolean;
      canceledAt: string | null;
      cancellationReason: string | null;
      createdAt: string;
      updatedAt: string;
    };

    plan:
      OrganizerSubscriptionCheckoutPlan;

    latestPayment:
      | OrganizerSubscriptionCheckoutPayment
      | null;

    state: {
      canPay: boolean;
      alreadyPaid: boolean;
      isActive: boolean;
      isPending: boolean;
      isCancelled: boolean;
      isExpired: boolean;
      paymentFailed: boolean;
      paymentRefunded: boolean;
      hasReusableCheckout: boolean;
    };
  }>;

export class GetSubscriptionCheckoutError
  extends Error {
  readonly code: string;
  readonly status: number;
  readonly redirectTo:
    | string
    | undefined;

  constructor({
    code,
    message,
    status = 400,
    redirectTo,
  }: {
    code: string;
    message: string;
    status?: number;
    redirectTo?: string;
  }) {
    super(message);

    this.name =
      "GetSubscriptionCheckoutError";
    this.code = code;
    this.status = status;
    this.redirectTo = redirectTo;

    Object.setPrototypeOf(
      this,
      new.target.prototype,
    );
  }
}

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string {
  return value?.trim() ?? "";
}

function normalizeCurrency(
  value:
    | string
    | null
    | undefined,
): string {
  const normalized =
    normalizeText(
      value,
    ).toUpperCase();

  return /^[A-Z]{3}$/.test(
    normalized,
  )
    ? normalized
    : "XOF";
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

function toIsoString(
  value:
    | Date
    | null
    | undefined,
): string | null {
  return value
    ? value.toISOString()
    : null;
}

function decimalToNumber(
  value:
    | Prisma.Decimal
    | number
    | string,
): number {
  const parsed =
    Number(value);

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : 0;
}

function formatMoney(
  value:
    | Prisma.Decimal
    | number
    | string,
  currency: string,
): string {
  const amount =
    decimalToNumber(value);

  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style: "currency",
        currency:
          normalizeCurrency(
            currency,
          ),
        minimumFractionDigits:
          Number.isInteger(
            amount,
          )
            ? 0
            : 2,
        maximumFractionDigits:
          2,
      },
    ).format(amount);
  } catch {
    return `${amount.toLocaleString(
      "fr-FR",
    )} ${normalizeCurrency(
      currency,
    )}`;
  }
}

function readJsonObject(
  value:
    | Prisma.JsonValue
    | null,
): Record<string, unknown> {
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

function readMetadataString(
  metadata:
    | Prisma.JsonValue
    | null,
  key: string,
): string | null {
  const value =
    readJsonObject(
      metadata,
    )[key];

  return typeof value ===
      "string" &&
    value.trim()
    ? value.trim()
    : null;
}

function normalizeFeatures(
  value:
    | Prisma.JsonValue
    | null,
): CheckoutFeature[] {
  if (!value) {
    return [];
  }

  if (
    Array.isArray(value)
  ) {
    return value
      .map(
        (
          item,
          index,
        ): CheckoutFeature | null => {
          if (
            typeof item ===
            "string"
          ) {
            const label =
              item.trim();

            return label
              ? {
                  key:
                    `feature-${index + 1}`,
                  label,
                  description:
                    null,
                  included:
                    true,
                }
              : null;
          }

          if (
            typeof item ===
              "object" &&
            item !== null &&
            !Array.isArray(
              item,
            )
          ) {
            const object =
              item as Record<
                string,
                Prisma.JsonValue
              >;

            const key =
              typeof object.key ===
                "string" &&
              object.key.trim()
                ? object.key.trim()
                : `feature-${index + 1}`;

            const label =
              typeof object.label ===
                "string" &&
              object.label.trim()
                ? object.label.trim()
                : key
                    .replace(
                      /[_-]+/g,
                      " ",
                    )
                    .trim();

            if (!label) {
              return null;
            }

            return {
              key,
              label,
              description:
                typeof object.description ===
                  "string" &&
                object.description.trim()
                  ? object.description.trim()
                  : null,
              included:
                typeof object.included ===
                "boolean"
                  ? object.included
                  : true,
            };
          }

          return null;
        },
      )
      .filter(
        (
          feature,
        ): feature is CheckoutFeature =>
          feature !== null,
      );
  }

  if (
    typeof value ===
      "object" &&
    value !== null
  ) {
    return Object.entries(
      value as Record<
        string,
        Prisma.JsonValue
      >,
    )
      .map(
        (
          [
            key,
            item,
          ],
        ): CheckoutFeature | null => {
          const label =
            key
              .replace(
                /[_-]+/g,
                " ",
              )
              .trim();

          if (!label) {
            return null;
          }

          return {
            key,
            label,
            description:
              typeof item ===
              "string"
                ? item
                : null,
            included:
              typeof item ===
              "boolean"
                ? item
                : true,
          };
        },
      )
      .filter(
        (
          feature,
        ): feature is CheckoutFeature =>
          feature !== null,
      );
  }

  return [];
}

function buildDisplayName({
  firstName,
  lastName,
  businessName,
}: {
  firstName: string;
  lastName: string;
  businessName:
    | string
    | null;
}): string {
  return (
    normalizeText(
      businessName,
    ) ||
    `${normalizeText(
      firstName,
    )} ${normalizeText(
      lastName,
    )}`.trim() ||
    "Organisateur Tikemia"
  );
}

async function getAuthenticatedOrganizer() {
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
    throw new GetSubscriptionCheckoutError({
      code:
        "UNAUTHORIZED",
      status: 401,
      message:
        "Votre session est absente ou expirée.",
      redirectTo:
        "/organizer/login",
    });
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
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            emailVerified: true,
            isActive: true,

            organizerProfile: {
              select: {
                businessName:
                  true,
                hasBlueBadge:
                  true,
              },
            },
          },
        },
      },
    });

  if (!session) {
    throw new GetSubscriptionCheckoutError({
      code:
        "INVALID_SESSION",
      status: 401,
      message:
        "Votre session n’est plus valide.",
      redirectTo:
        "/organizer/login",
    });
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
        (
          error: unknown,
        ) => {
          console.error(
            "[GET_SUBSCRIPTION_CHECKOUT_EXPIRED_SESSION_DELETE_ERROR]",
            error instanceof
              Error
              ? error.message
              : error,
          );
        },
      );

    throw new GetSubscriptionCheckoutError({
      code:
        "EXPIRED_SESSION",
      status: 401,
      message:
        "Votre session a expiré. Reconnectez-vous.",
      redirectTo:
        "/organizer/login",
    });
  }

  if (
    session.user.role !==
      UserRole.ORGANIZER ||
    !session.user
      .emailVerified ||
    !session.user.isActive
  ) {
    throw new GetSubscriptionCheckoutError({
      code:
        "FORBIDDEN",
      status: 403,
      message:
        "Votre compte organisateur ne peut pas accéder au paiement Premium.",
    });
  }

  return session.user;
}

function normalizeLatestPayment(
  payment: {
    id: string;
    amount: Prisma.Decimal;
    currency: string;
    provider: string;
    providerReference:
      | string
      | null;
    status: PaymentStatus;
    failureReason:
      | string
      | null;
    metadata:
      | Prisma.JsonValue
      | null;
    paidAt:
      | Date
      | null;
    createdAt: Date;
    updatedAt: Date;
  } | null,
): OrganizerSubscriptionCheckoutPayment | null {
  if (!payment) {
    return null;
  }

  const currency =
    normalizeCurrency(
      payment.currency,
    );

  return {
    id:
      payment.id,
    amount:
      decimalToNumber(
        payment.amount,
      ),
    amountFormatted:
      formatMoney(
        payment.amount,
        currency,
      ),
    currency,
    provider:
      normalizeText(
        payment.provider,
      ).toUpperCase(),
    providerReference:
      normalizeText(
        payment.providerReference,
      ) || null,
    providerTransactionId:
      readMetadataString(
        payment.metadata,
        "providerTransactionId",
      ),
    checkoutUrl:
      readMetadataString(
        payment.metadata,
        "checkoutUrl",
      ),
    returnUrl:
      readMetadataString(
        payment.metadata,
        "returnUrl",
      ),
    cancelUrl:
      readMetadataString(
        payment.metadata,
        "cancelUrl",
      ),
    status:
      payment.status,
    failureReason:
      normalizeText(
        payment.failureReason,
      ) || null,
    paidAt:
      toIsoString(
        payment.paidAt,
      ),
    createdAt:
      payment.createdAt
        .toISOString(),
    updatedAt:
      payment.updatedAt
        .toISOString(),
  };
}

export async function getSubscriptionCheckout({
  subscriptionId,
}: {
  subscriptionId: string;
}): Promise<OrganizerSubscriptionCheckout> {
  const normalizedSubscriptionId =
    normalizeText(
      subscriptionId,
    );

  if (
    !normalizedSubscriptionId
  ) {
    throw new GetSubscriptionCheckoutError({
      code:
        "SUBSCRIPTION_ID_REQUIRED",
      status: 400,
      message:
        "L’identifiant de l’abonnement Premium est obligatoire.",
      redirectTo:
        "/organizer/promotions",
    });
  }

  try {
    const organizer =
      await getAuthenticatedOrganizer();

    const subscription =
      await prisma.organizerSubscription
        .findFirst({
          where: {
            id:
              normalizedSubscriptionId,
            organizerId:
              organizer.id,
          },

          select: {
            id: true,
            organizerId: true,
            planId: true,
            status: true,
            startsAt: true,
            endsAt: true,
            trialEndsAt: true,
            autoRenew: true,
            canceledAt: true,
            cancellationReason:
              true,
            createdAt: true,
            updatedAt: true,

            plan: {
              select: {
                id: true,
                code: true,
                name: true,
                description: true,
                price: true,
                currency: true,
                billingPeriod:
                  true,
                durationDays:
                  true,
                maxBoostedEvents:
                  true,
                priorityScore:
                  true,
                features: true,
                isActive: true,
                isPublic: true,
              },
            },

            payments: {
              orderBy: [
                {
                  createdAt:
                    "desc",
                },
                {
                  id:
                    "desc",
                },
              ],
              take: 1,

              select: {
                id: true,
                amount: true,
                currency: true,
                provider: true,
                providerReference:
                  true,
                status: true,
                failureReason:
                  true,
                metadata: true,
                paidAt: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        });

    if (!subscription) {
      throw new GetSubscriptionCheckoutError({
        code:
          "SUBSCRIPTION_NOT_FOUND",
        status: 404,
        message:
          "Cette demande d’abonnement Premium est introuvable.",
        redirectTo:
          "/organizer/promotions",
      });
    }

    const latestPayment =
      normalizeLatestPayment(
        subscription
          .payments[0] ??
          null,
      );

    const alreadyPaid =
      latestPayment?.status ===
        PaymentStatus.SUCCESS;

    const isActive =
      subscription.status ===
        SubscriptionStatus.ACTIVE;

    const isPending =
      subscription.status ===
        SubscriptionStatus.PENDING;

    const isCancelled =
      subscription.status ===
        SubscriptionStatus.CANCELLED;

    const isExpired =
      subscription.status ===
        SubscriptionStatus.EXPIRED;

    const paymentFailed =
      latestPayment?.status ===
        PaymentStatus.FAILED;

    const paymentRefunded =
      latestPayment?.status ===
        PaymentStatus.REFUNDED;

    const hasReusableCheckout =
      Boolean(
        latestPayment &&
          latestPayment.status ===
            PaymentStatus.PENDING &&
          latestPayment.checkoutUrl,
      );

    /*
     * Le paiement ne doit être proposé que pour une souscription encore
     * PENDING et non déjà confirmée. La route de création du paiement fera
     * de nouveau toutes les validations côté serveur : cette valeur sert
     * uniquement à l'interface.
     */
    const canPay =
      isPending &&
      !alreadyPaid &&
      !paymentRefunded &&
      subscription.plan
        .isActive &&
      subscription.plan
        .isPublic;

    const planCurrency =
      normalizeCurrency(
        subscription.plan
          .currency,
      );

    return Object.freeze({
      organizer: {
        id:
          organizer.id,
        firstName:
          organizer.firstName,
        lastName:
          organizer.lastName,
        displayName:
          buildDisplayName({
            firstName:
              organizer.firstName,
            lastName:
              organizer.lastName,
            businessName:
              organizer
                .organizerProfile
                ?.businessName ??
              null,
          }),
        email:
          organizer.email,
        hasBlueBadge:
          organizer
            .organizerProfile
            ?.hasBlueBadge ??
          false,
      },

      subscription: {
        id:
          subscription.id,
        organizerId:
          subscription
            .organizerId,
        planId:
          subscription.planId,
        status:
          subscription.status,
        startsAt:
          toIsoString(
            subscription.startsAt,
          ),
        endsAt:
          toIsoString(
            subscription.endsAt,
          ),
        trialEndsAt:
          toIsoString(
            subscription
              .trialEndsAt,
          ),
        autoRenew:
          subscription.autoRenew,
        canceledAt:
          toIsoString(
            subscription.canceledAt,
          ),
        cancellationReason:
          subscription
            .cancellationReason,
        createdAt:
          subscription.createdAt
            .toISOString(),
        updatedAt:
          subscription.updatedAt
            .toISOString(),
      },

      plan: {
        id:
          subscription.plan.id,
        code:
          subscription.plan.code,
        name:
          subscription.plan.name,
        description:
          subscription.plan
            .description,
        price:
          decimalToNumber(
            subscription.plan
              .price,
          ),
        priceFormatted:
          formatMoney(
            subscription.plan
              .price,
            planCurrency,
          ),
        currency:
          planCurrency,
        billingPeriod:
          subscription.plan
            .billingPeriod,
        durationDays:
          subscription.plan
            .durationDays,
        maxBoostedEvents:
          subscription.plan
            .maxBoostedEvents,
        priorityScore:
          subscription.plan
            .priorityScore,
        features:
          normalizeFeatures(
            subscription.plan
              .features,
          ),
        isActive:
          subscription.plan
            .isActive,
        isPublic:
          subscription.plan
            .isPublic,
      },

      latestPayment,

      state: {
        canPay,
        alreadyPaid,
        isActive,
        isPending,
        isCancelled,
        isExpired,
        paymentFailed,
        paymentRefunded,
        hasReusableCheckout,
      },
    });
  } catch (error) {
    if (
      error instanceof
      GetSubscriptionCheckoutError
    ) {
      throw error;
    }

    console.error(
      "[GET_SUBSCRIPTION_CHECKOUT_ERROR]",
      error instanceof
        Error
        ? {
            name:
              error.name,
            message:
              error.message,
            stack:
              process.env
                .NODE_ENV ===
              "development"
                ? error.stack
                : undefined,
          }
        : error,
    );

    throw new GetSubscriptionCheckoutError({
      code:
        "GET_SUBSCRIPTION_CHECKOUT_FAILED",
      status: 500,
      message:
        "Impossible de charger le paiement de l’abonnement Premium pour le moment.",
    });
  }
}