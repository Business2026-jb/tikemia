import "server-only";

import { createHash } from "node:crypto";

import {
  type Prisma,
  type SubscriptionBillingPeriod,
} from "@prisma/client";
import { cookies } from "next/headers";

import {
  subscriptionPlansQuerySchema,
  type SubscriptionPlansQueryInput,
} from "@/lib/organizer/promotions/promotion-schemas";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE_FALLBACK_NAME =
  "tikemia_session";

const DEFAULT_CURRENCY = "XOF";

export type SubscriptionPlanFeature = {
  key: string;
  label: string;
  description: string | null;
  included: boolean;
};

export type OrganizerSubscriptionPlan = {
  id: string;
  code: string;
  name: string;
  description: string | null;

  price: number;
  currency: string;
  formattedPrice: string;

  billingPeriod: SubscriptionBillingPeriod;
  billingPeriodLabel: string;
  durationDays: number;

  maxBoostedEvents: number;
  priorityScore: number;

  features: SubscriptionPlanFeature[];

  isActive: boolean;
  isPublic: boolean;
  sortOrder: number;

  createdAt: string;
  updatedAt: string;
};

export type GetSubscriptionPlansResult = {
  organizer: {
    id: string;
    firstName: string;
    lastName: string;
    displayName: string;
    preferredCurrency: string;
    hasBlueBadge: boolean;
    blueBadgeGrantedAt: string | null;
    firstSubscribedAt: string | null;
  };

  filters: {
    billingPeriod:
      | SubscriptionBillingPeriod
      | null;
    currency: string;
  };

  summary: {
    totalPlans: number;
    minimumPrice: number;
    maximumPrice: number;
    maximumBoostedEvents: number;
    highestPriorityScore: number;
  };

  plans: OrganizerSubscriptionPlan[];
};

export class GetSubscriptionPlansError extends Error {
  readonly code: string;
  readonly status: number;
  readonly redirectTo?: string;

  constructor({
    code,
    message,
    status = 500,
    redirectTo,
  }: {
    code: string;
    message: string;
    status?: number;
    redirectTo?: string;
  }) {
    super(message);

    this.name =
      "GetSubscriptionPlansError";
    this.code = code;
    this.status = status;
    this.redirectTo = redirectTo;
  }
}

type JsonObject = {
  [key: string]: Prisma.JsonValue;
};

function hashSessionToken(
  token: string,
): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

function decimalToNumber(
  value:
    | Prisma.Decimal
    | number
    | string
    | null
    | undefined,
): number {
  if (
    value === null ||
    value === undefined
  ) {
    return 0;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function normalizeCurrency(
  value: string | null | undefined,
): string {
  const normalized =
    value?.trim().toUpperCase();

  return normalized &&
    /^[A-Z]{3}$/.test(normalized)
    ? normalized
    : DEFAULT_CURRENCY;
}

function getBillingPeriodLabel(
  period: SubscriptionBillingPeriod,
): string {
  switch (period) {
    case "ONE_TIME":
      return "Paiement unique";

    case "MONTHLY":
      return "Mensuel";

    case "QUARTERLY":
      return "Trimestriel";

    case "YEARLY":
      return "Annuel";

    default:
      return period;
  }
}

function formatMoney(
  amount: number,
  currency: string,
): string {
  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style: "currency",
        currency,
        maximumFractionDigits:
          currency === "XOF" ? 0 : 2,
      },
    ).format(amount);
  } catch {
    return `${amount.toLocaleString(
      "fr-FR",
    )} ${currency}`;
  }
}

function isJsonObject(
  value: Prisma.JsonValue,
): value is JsonObject {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function normalizeFeatureLabel(
  value: string,
): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(
      /(^|\s)\S/g,
      (character) =>
        character.toUpperCase(),
    );
}

function normalizeFeatureItem({
  value,
  index,
}: {
  value: Prisma.JsonValue;
  index: number;
}): SubscriptionPlanFeature | null {
  if (typeof value === "string") {
    const label = value.trim();

    if (!label) {
      return null;
    }

    return {
      key: `feature-${index + 1}`,
      label,
      description: null,
      included: true,
    };
  }

  if (typeof value === "boolean") {
    return {
      key: `feature-${index + 1}`,
      label: `Avantage ${index + 1}`,
      description: null,
      included: value,
    };
  }

  if (!isJsonObject(value)) {
    return null;
  }

  const rawKey =
    typeof value.key === "string"
      ? value.key.trim()
      : "";

  const rawLabel =
    typeof value.label === "string"
      ? value.label.trim()
      : "";

  const rawDescription =
    typeof value.description === "string"
      ? value.description.trim()
      : "";

  const included =
    typeof value.included === "boolean"
      ? value.included
      : true;

  const key =
    rawKey ||
    `feature-${index + 1}`;

  const label =
    rawLabel ||
    normalizeFeatureLabel(key);

  if (!label) {
    return null;
  }

  return {
    key,
    label,
    description:
      rawDescription || null,
    included,
  };
}

function normalizePlanFeatures(
  value: Prisma.JsonValue | null,
): SubscriptionPlanFeature[] {
  if (value === null) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map((item, index) =>
        normalizeFeatureItem({
          value: item,
          index,
        }),
      )
      .filter(
        (
          item,
        ): item is SubscriptionPlanFeature =>
          item !== null,
      );
  }

  if (isJsonObject(value)) {
    return Object.entries(value)
      .map(
        ([key, itemValue], index) => {
          if (
            typeof itemValue ===
            "boolean"
          ) {
            return {
              key,
              label:
                normalizeFeatureLabel(
                  key,
                ),
              description: null,
              included: itemValue,
            };
          }

          if (
            typeof itemValue ===
            "string"
          ) {
            return {
              key,
              label:
                normalizeFeatureLabel(
                  key,
                ),
              description:
                itemValue.trim() ||
                null,
              included: true,
            };
          }

          if (isJsonObject(itemValue)) {
            return normalizeFeatureItem({
              value: {
                ...itemValue,
                key,
              },
              index,
            });
          }

          return null;
        },
      )
      .filter(
        (
          item,
        ): item is SubscriptionPlanFeature =>
          item !== null,
      );
  }

  return [];
}

async function getAuthenticatedOrganizer() {
  const cookieStore = await cookies();

  const sessionCookieName =
    process.env.SESSION_COOKIE_NAME?.trim() ||
    SESSION_COOKIE_FALLBACK_NAME;

  const sessionToken =
    cookieStore.get(
      sessionCookieName,
    )?.value;

  if (!sessionToken) {
    throw new GetSubscriptionPlansError({
      code: "UNAUTHORIZED",
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
            role: true,
            emailVerified: true,
            isActive: true,

            organizerProfile: {
              select: {
                businessName: true,
                hasBlueBadge: true,
                blueBadgeGrantedAt: true,
                firstSubscribedAt: true,
              },
            },

            organizerSettings: {
              select: {
                currency: true,
              },
            },
          },
        },
      },
    });

  if (!session) {
    throw new GetSubscriptionPlansError({
      code: "INVALID_SESSION",
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
          id: session.id,
        },
      })
      .catch((error: unknown) => {
        console.error(
          "[GET_SUBSCRIPTION_PLANS_EXPIRED_SESSION_DELETE_ERROR]",
          error instanceof Error
            ? error.message
            : error,
        );
      });

    throw new GetSubscriptionPlansError({
      code: "EXPIRED_SESSION",
      status: 401,
      message:
        "Votre session a expiré. Reconnectez-vous.",
      redirectTo:
        "/organizer/login",
    });
  }

  if (
    session.user.role !==
      "ORGANIZER" ||
    !session.user.emailVerified ||
    !session.user.isActive
  ) {
    throw new GetSubscriptionPlansError({
      code: "FORBIDDEN",
      status: 403,
      message:
        "Votre compte organisateur ne peut pas accéder aux formules Premium.",
    });
  }

  return session.user;
}

export async function getSubscriptionPlans(
  input: SubscriptionPlansQueryInput = {},
): Promise<GetSubscriptionPlansResult> {
  try {
    const organizer =
      await getAuthenticatedOrganizer();

    const parsedInput =
      subscriptionPlansQuerySchema.safeParse(
        input,
      );

    if (!parsedInput.success) {
      throw new GetSubscriptionPlansError({
        code: "INVALID_QUERY",
        status: 400,
        message:
          parsedInput.error.issues[0]
            ?.message ??
          "Les filtres des formules sont invalides.",
      });
    }

    /*
     * Cette fonction appartient à l’espace organisateur.
     * Les formules privées ou désactivées ne sont jamais
     * exposées, même si ces options sont présentes dans
     * le schéma partagé pour les futurs usages admin.
     */
    const preferredCurrency =
      normalizeCurrency(
        parsedInput.data.currency ??
          organizer.organizerSettings
            ?.currency,
      );

    const baseWhere:
      Prisma.SubscriptionPlanWhereInput =
      {
        isActive: true,
        isPublic: true,

        ...(parsedInput.data
          .billingPeriod
          ? {
              billingPeriod:
                parsedInput.data
                  .billingPeriod,
            }
          : {}),
      };

    const orderBy:
      Prisma.SubscriptionPlanOrderByWithRelationInput[] =
      [
        {
          sortOrder: "asc",
        },
        {
          price: "asc",
        },
        {
          createdAt: "asc",
        },
        {
          id: "asc",
        },
      ];

    const select = {
      id: true,
      code: true,
      name: true,
      description: true,
      price: true,
      currency: true,
      billingPeriod: true,
      durationDays: true,
      maxBoostedEvents: true,
      priorityScore: true,
      features: true,
      isActive: true,
      isPublic: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
    } satisfies Prisma.SubscriptionPlanSelect;

    /*
     * Les formules Premium sont globales à Tikemia.
     *
     * La devise préférée de l'organisateur ne doit jamais déterminer
     * si une formule est visible ou non. Toutes les formules publiques
     * et actives sont donc chargées, quelle que soit leur devise.
     *
     * Chaque formule conserve son prix et sa devise réels. Aucune
     * conversion n'est effectuée ici : le checkout et le prestataire
     * de paiement utilisent ensuite directement plan.price et
     * plan.currency côté serveur.
     */
    const plans =
      await prisma.subscriptionPlan.findMany({
        where:
          baseWhere,

        orderBy,

        select,
      });

    const normalizedPlans:
      OrganizerSubscriptionPlan[] =
      plans.map((plan) => {
        const price =
          decimalToNumber(plan.price);

        const currency =
          normalizeCurrency(
            plan.currency,
          );

        return {
          id: plan.id,
          code: plan.code,
          name: plan.name,
          description:
            plan.description,
          price,
          currency,
          formattedPrice:
            formatMoney(
              price,
              currency,
            ),
          billingPeriod:
            plan.billingPeriod,
          billingPeriodLabel:
            getBillingPeriodLabel(
              plan.billingPeriod,
            ),
          durationDays:
            Math.max(
              plan.durationDays,
              1,
            ),
          maxBoostedEvents:
            Math.max(
              plan.maxBoostedEvents,
              0,
            ),
          priorityScore:
            Math.max(
              plan.priorityScore,
              0,
            ),
          features:
            normalizePlanFeatures(
              plan.features,
            ),
          isActive:
            plan.isActive,
          isPublic:
            plan.isPublic,
          sortOrder:
            plan.sortOrder,
          createdAt:
            plan.createdAt.toISOString(),
          updatedAt:
            plan.updatedAt.toISOString(),
        };
      });

    const prices =
      normalizedPlans.map(
        (plan) => plan.price,
      );

    const firstName =
      organizer.firstName.trim();

    const lastName =
      organizer.lastName.trim();

    const businessName =
      organizer.organizerProfile
        ?.businessName?.trim() ||
      null;

    return {
      organizer: {
        id: organizer.id,
        firstName,
        lastName,
        displayName:
          businessName ||
          `${firstName} ${lastName}`.trim() ||
          "Organisateur Tikemia",
        preferredCurrency,
        hasBlueBadge:
          organizer.organizerProfile
            ?.hasBlueBadge ??
          false,
        blueBadgeGrantedAt:
          organizer.organizerProfile
            ?.blueBadgeGrantedAt
            ?.toISOString() ??
          null,
        firstSubscribedAt:
          organizer.organizerProfile
            ?.firstSubscribedAt
            ?.toISOString() ??
          null,
      },

      filters: {
        billingPeriod:
          parsedInput.data
            .billingPeriod ??
          null,
        currency:
          preferredCurrency,
      },

      summary: {
        totalPlans:
          normalizedPlans.length,
        minimumPrice:
          prices.length > 0
            ? Math.min(...prices)
            : 0,
        maximumPrice:
          prices.length > 0
            ? Math.max(...prices)
            : 0,
        maximumBoostedEvents:
          normalizedPlans.reduce(
            (maximum, plan) =>
              Math.max(
                maximum,
                plan.maxBoostedEvents,
              ),
            0,
          ),
        highestPriorityScore:
          normalizedPlans.reduce(
            (maximum, plan) =>
              Math.max(
                maximum,
                plan.priorityScore,
              ),
            0,
          ),
      },

      plans: normalizedPlans,
    };
  } catch (error) {
    if (
      error instanceof
      GetSubscriptionPlansError
    ) {
      throw error;
    }

    console.error(
      "[GET_SUBSCRIPTION_PLANS_ERROR]",
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack:
              process.env.NODE_ENV ===
              "development"
                ? error.stack
                : undefined,
          }
        : error,
    );

    throw new GetSubscriptionPlansError({
      code:
        "GET_SUBSCRIPTION_PLANS_FAILED",
      status: 500,
      message:
        "Impossible de charger les formules Premium pour le moment.",
    });
  }
}