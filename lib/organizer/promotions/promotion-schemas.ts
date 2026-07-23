import {
  EventBoostSource,
  EventBoostStatus,
  PaymentStatus,
  SubscriptionBillingPeriod,
  SubscriptionStatus,
} from "@prisma/client";
import { z } from "zod";

const MAX_SEARCH_LENGTH = 120;
const MAX_REASON_LENGTH = 1_000;
const MAX_NOTES_LENGTH = 2_000;
const MAX_PROVIDER_REFERENCE_LENGTH = 255;
const MAX_METADATA_LENGTH = 20_000;
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const subscriptionStatusValues = Object.values(
  SubscriptionStatus,
) as [SubscriptionStatus, ...SubscriptionStatus[]];

const subscriptionBillingPeriodValues = Object.values(
  SubscriptionBillingPeriod,
) as [
  SubscriptionBillingPeriod,
  ...SubscriptionBillingPeriod[],
];

const paymentStatusValues = Object.values(
  PaymentStatus,
) as [PaymentStatus, ...PaymentStatus[]];

const eventBoostStatusValues = Object.values(
  EventBoostStatus,
) as [EventBoostStatus, ...EventBoostStatus[]];

const eventBoostSourceValues = Object.values(
  EventBoostSource,
) as [EventBoostSource, ...EventBoostSource[]];

export const subscriptionStatusSchema = z.enum(
  subscriptionStatusValues,
);

export const subscriptionBillingPeriodSchema = z.enum(
  subscriptionBillingPeriodValues,
);

export const paymentStatusSchema = z.enum(
  paymentStatusValues,
);

export const eventBoostStatusSchema = z.enum(
  eventBoostStatusValues,
);

export const eventBoostSourceSchema = z.enum(
  eventBoostSourceValues,
);

function trimmedOptionalString(maximumLength: number) {
  return z.preprocess(
    (value) => {
      if (value === undefined || value === null) {
        return undefined;
      }

      if (typeof value !== "string") {
        return value;
      }

      const normalized = value.trim();

      return normalized.length > 0
        ? normalized
        : undefined;
    },
    z.string().max(maximumLength).optional(),
  );
}

function trimmedNullableString(maximumLength: number) {
  return z.preprocess(
    (value) => {
      if (value === undefined || value === null) {
        return null;
      }

      if (typeof value !== "string") {
        return value;
      }

      const normalized = value.trim();

      return normalized.length > 0
        ? normalized
        : null;
    },
    z.string().max(maximumLength).nullable(),
  );
}

function positiveIntegerFromUnknown(
  fallback: number,
  maximum: number,
) {
  return z.preprocess(
    (value) => {
      if (
        value === undefined ||
        value === null ||
        value === ""
      ) {
        return fallback;
      }

      if (
        typeof value === "string" &&
        value.trim() !== ""
      ) {
        const parsed = Number(value);

        return Number.isFinite(parsed)
          ? parsed
          : value;
      }

      return value;
    },
    z.number().int().min(1).max(maximum),
  );
}

const optionalBooleanFromUnknown = z.preprocess(
  (value) => {
    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      return undefined;
    }

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();

      if (["true", "1", "yes", "on"].includes(normalized)) {
        return true;
      }

      if (["false", "0", "no", "off"].includes(normalized)) {
        return false;
      }
    }

    return value;
  },
  z.boolean().optional(),
);

const requiredBooleanFromUnknown = z.preprocess(
  (value) => {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();

      if (["true", "1", "yes", "on"].includes(normalized)) {
        return true;
      }

      if (["false", "0", "no", "off"].includes(normalized)) {
        return false;
      }
    }

    return value;
  },
  z.boolean(),
);

const dateFromUnknown = z.preprocess(
  (value) => {
    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      return undefined;
    }

    if (value instanceof Date) {
      return value;
    }

    if (
      typeof value === "string" ||
      typeof value === "number"
    ) {
      const parsed = new Date(value);

      return Number.isNaN(parsed.getTime())
        ? value
        : parsed;
    }

    return value;
  },
  z.date().optional(),
);

const nullableDateFromUnknown = z.preprocess(
  (value) => {
    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      return null;
    }

    if (value instanceof Date) {
      return value;
    }

    if (
      typeof value === "string" ||
      typeof value === "number"
    ) {
      const parsed = new Date(value);

      return Number.isNaN(parsed.getTime())
        ? value
        : parsed;
    }

    return value;
  },
  z.date().nullable(),
);

const currencySchema = z.preprocess(
  (value) =>
    typeof value === "string"
      ? value.trim().toUpperCase()
      : value,
  z
    .string()
    .regex(
      /^[A-Z]{3}$/,
      "La devise doit contenir exactement trois lettres.",
    ),
);

const cuidSchema = z
  .string()
  .trim()
  .min(1, "L’identifiant est obligatoire.")
  .max(191, "L’identifiant est trop long.");

const providerSchema = z
  .string()
  .trim()
  .min(2, "Le prestataire de paiement est obligatoire.")
  .max(80, "Le nom du prestataire est trop long.")
  .transform((value) => value.toUpperCase());

const jsonMetadataSchema = z
  .unknown()
  .optional()
  .refine(
    (value) => {
      if (value === undefined) {
        return true;
      }

      try {
        return JSON.stringify(value).length <= MAX_METADATA_LENGTH;
      } catch {
        return false;
      }
    },
    {
      message:
        "Les métadonnées sont invalides ou trop volumineuses.",
    },
  );

export const promotionSortSchema = z.enum([
  "created-desc",
  "created-asc",
  "updated-desc",
  "updated-asc",
  "starts-desc",
  "starts-asc",
  "ends-desc",
  "ends-asc",
  "priority-desc",
  "priority-asc",
  "name-asc",
  "name-desc",
]);

export const promotionHistoryTypeSchema = z.enum([
  "ALL",
  "SUBSCRIPTION",
  "PAYMENT",
  "BOOST",
]);

export const promotionPaymentMethodSchema = z.enum([
  "MTN_MOMO",
  "MOOV_MONEY",
  "ORANGE_MONEY",
  "WAVE",
  "CARD",
]);

export const promotionActionSchema = z.enum([
  "ASSIGN_EVENT",
  "REMOVE_EVENT",
  "PAUSE_EVENT",
  "RESUME_EVENT",
  "CANCEL_SUBSCRIPTION",
  "RENEW_SUBSCRIPTION",
  "ENABLE_AUTO_RENEW",
  "DISABLE_AUTO_RENEW",
]);

export const organizerPromotionsQuerySchema = z
  .object({
    search: trimmedOptionalString(MAX_SEARCH_LENGTH),
    subscriptionStatus: subscriptionStatusSchema.optional(),
    boostStatus: eventBoostStatusSchema.optional(),
    historyType: promotionHistoryTypeSchema.default("ALL"),
    sort: promotionSortSchema.default("created-desc"),
    page: positiveIntegerFromUnknown(DEFAULT_PAGE, 1_000_000),
    pageSize: positiveIntegerFromUnknown(
      DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE,
    ),
    includeHistory: optionalBooleanFromUnknown.default(true),
    includeAvailableEvents:
      optionalBooleanFromUnknown.default(true),
    includePlans: optionalBooleanFromUnknown.default(true),
  })
  .strict();

export const subscriptionPlansQuerySchema = z
  .object({
    billingPeriod: subscriptionBillingPeriodSchema.optional(),
    currency: currencySchema.optional(),
    includeInactive: optionalBooleanFromUnknown.default(false),
    includePrivate: optionalBooleanFromUnknown.default(false),
  })
  .strict();

export const createOrganizerSubscriptionSchema = z
  .object({
    planId: cuidSchema,
    autoRenew: requiredBooleanFromUnknown.default(false),
    paymentMethod: promotionPaymentMethodSchema,
    currency: currencySchema.optional(),
    returnUrl: trimmedOptionalString(2_000),
    cancelUrl: trimmedOptionalString(2_000),
    metadata: jsonMetadataSchema,
  })
  .strict();

export const activateOrganizerSubscriptionSchema = z
  .object({
    subscriptionId: cuidSchema,
    paymentId: cuidSchema,
    providerReference: trimmedOptionalString(
      MAX_PROVIDER_REFERENCE_LENGTH,
    ),
    paidAt: dateFromUnknown.default(new Date()),
    metadata: jsonMetadataSchema,
  })
  .strict();

export const cancelOrganizerSubscriptionSchema = z
  .object({
    subscriptionId: cuidSchema.optional(),
    cancelAtPeriodEnd: requiredBooleanFromUnknown.default(true),
    reason: trimmedNullableString(MAX_REASON_LENGTH),
    notes: trimmedNullableString(MAX_NOTES_LENGTH),
  })
  .strict();

export const renewOrganizerSubscriptionSchema = z
  .object({
    subscriptionId: cuidSchema.optional(),
    planId: cuidSchema.optional(),
    paymentMethod: promotionPaymentMethodSchema,
    autoRenew: optionalBooleanFromUnknown,
    currency: currencySchema.optional(),
    metadata: jsonMetadataSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.subscriptionId && !value.planId) {
      context.addIssue({
        code: "custom",
        path: ["subscriptionId"],
        message:
          "L’abonnement ou la formule à renouveler est obligatoire.",
      });
    }
  });

export const updateAutoRenewSchema = z
  .object({
    subscriptionId: cuidSchema.optional(),
    autoRenew: requiredBooleanFromUnknown,
  })
  .strict();

export const assignPromotedEventSchema = z
  .object({
    eventId: cuidSchema,
    subscriptionId: cuidSchema.optional(),
    startsAt: dateFromUnknown,
    endsAt: dateFromUnknown,
    priorityScore: z.coerce.number().int().min(0).max(1_000_000).optional(),
    source: eventBoostSourceSchema.default(
      EventBoostSource.SUBSCRIPTION,
    ),
    metadata: jsonMetadataSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.startsAt &&
      value.endsAt &&
      value.endsAt.getTime() <= value.startsAt.getTime()
    ) {
      context.addIssue({
        code: "custom",
        path: ["endsAt"],
        message:
          "La date de fin doit être postérieure à la date de début.",
      });
    }

    if (
      value.source === EventBoostSource.SUBSCRIPTION &&
      !value.subscriptionId
    ) {
      context.addIssue({
        code: "custom",
        path: ["subscriptionId"],
        message:
          "L’abonnement est obligatoire pour une promotion issue d’un abonnement.",
      });
    }
  });

export const updatePromotedEventSchema = z
  .object({
    boostId: cuidSchema.optional(),
    eventId: cuidSchema.optional(),
    status: eventBoostStatusSchema.optional(),
    startsAt: nullableDateFromUnknown.optional(),
    endsAt: nullableDateFromUnknown.optional(),
    priorityScore: z.coerce.number().int().min(0).max(1_000_000).optional(),
    cancellationReason: trimmedNullableString(MAX_REASON_LENGTH),
    metadata: jsonMetadataSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.boostId && !value.eventId) {
      context.addIssue({
        code: "custom",
        path: ["boostId"],
        message:
          "La promotion ou l’événement est obligatoire.",
      });
    }

    if (
      value.startsAt instanceof Date &&
      value.endsAt instanceof Date &&
      value.endsAt.getTime() <= value.startsAt.getTime()
    ) {
      context.addIssue({
        code: "custom",
        path: ["endsAt"],
        message:
          "La date de fin doit être postérieure à la date de début.",
      });
    }

    if (
      value.status === EventBoostStatus.CANCELLED &&
      !value.cancellationReason
    ) {
      context.addIssue({
        code: "custom",
        path: ["cancellationReason"],
        message:
          "Une raison est obligatoire pour annuler cette promotion.",
      });
    }
  });

export const removePromotedEventSchema = z
  .object({
    eventId: cuidSchema.optional(),
    boostId: cuidSchema.optional(),
    reason: trimmedNullableString(MAX_REASON_LENGTH),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.eventId && !value.boostId) {
      context.addIssue({
        code: "custom",
        path: ["boostId"],
        message:
          "La promotion ou l’événement à retirer est obligatoire.",
      });
    }
  });

export const createSubscriptionPaymentSchema = z
  .object({
    subscriptionId: cuidSchema,
    amount: z
      .coerce
      .number()
      .positive("Le montant doit être supérieur à zéro.")
      .max(1_000_000_000_000, "Le montant est trop élevé."),
    currency: currencySchema,
    provider: providerSchema,
    paymentMethod: promotionPaymentMethodSchema,
    providerReference: trimmedOptionalString(
      MAX_PROVIDER_REFERENCE_LENGTH,
    ),
    metadata: jsonMetadataSchema,
  })
  .strict();

export const updateSubscriptionPaymentSchema = z
  .object({
    paymentId: cuidSchema.optional(),
    providerReference: trimmedOptionalString(
      MAX_PROVIDER_REFERENCE_LENGTH,
    ),
    status: paymentStatusSchema,
    failureReason: trimmedNullableString(MAX_REASON_LENGTH),
    paidAt: nullableDateFromUnknown.optional(),
    metadata: jsonMetadataSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.status === PaymentStatus.FAILED &&
      !value.failureReason
    ) {
      context.addIssue({
        code: "custom",
        path: ["failureReason"],
        message:
          "La raison de l’échec du paiement est obligatoire.",
      });
    }
  });

export const subscriptionPaymentLookupSchema = z
  .object({
    paymentId: cuidSchema.optional(),
    providerReference: trimmedOptionalString(
      MAX_PROVIDER_REFERENCE_LENGTH,
    ),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.paymentId && !value.providerReference) {
      context.addIssue({
        code: "custom",
        path: ["paymentId"],
        message:
          "L’identifiant du paiement ou la référence du prestataire est obligatoire.",
      });
    }
  });

export const promotionPerformanceQuerySchema = z
  .object({
    eventId: cuidSchema.optional(),
    boostId: cuidSchema.optional(),
    startsAt: dateFromUnknown,
    endsAt: dateFromUnknown,
    groupBy: z.enum(["DAY", "WEEK", "MONTH"]).default("DAY"),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.startsAt &&
      value.endsAt &&
      value.endsAt.getTime() <= value.startsAt.getTime()
    ) {
      context.addIssue({
        code: "custom",
        path: ["endsAt"],
        message:
          "La date de fin doit être postérieure à la date de début.",
      });
    }
  });

export const promotionHistoryQuerySchema = z
  .object({
    type: promotionHistoryTypeSchema.default("ALL"),
    status: trimmedOptionalString(50),
    search: trimmedOptionalString(MAX_SEARCH_LENGTH),
    startsAt: dateFromUnknown,
    endsAt: dateFromUnknown,
    page: positiveIntegerFromUnknown(DEFAULT_PAGE, 1_000_000),
    pageSize: positiveIntegerFromUnknown(
      DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE,
    ),
    sort: promotionSortSchema.default("created-desc"),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.startsAt &&
      value.endsAt &&
      value.endsAt.getTime() < value.startsAt.getTime()
    ) {
      context.addIssue({
        code: "custom",
        path: ["endsAt"],
        message:
          "La date de fin doit être égale ou postérieure à la date de début.",
      });
    }
  });

export const promotionWebhookSchema = z
  .object({
    provider: providerSchema,
    providerReference: z
      .string()
      .trim()
      .min(1, "La référence du prestataire est obligatoire.")
      .max(MAX_PROVIDER_REFERENCE_LENGTH),
    status: paymentStatusSchema,
    amount: z.coerce.number().nonnegative().optional(),
    currency: currencySchema.optional(),
    paidAt: nullableDateFromUnknown.optional(),
    failureReason: trimmedNullableString(MAX_REASON_LENGTH),
    signature: trimmedOptionalString(2_000),
    metadata: jsonMetadataSchema,
  })
  .strict();

export const adminUpdateSubscriptionSchema = z
  .object({
    subscriptionId: cuidSchema,
    status: subscriptionStatusSchema.optional(),
    startsAt: nullableDateFromUnknown.optional(),
    endsAt: nullableDateFromUnknown.optional(),
    autoRenew: optionalBooleanFromUnknown,
    reason: trimmedNullableString(MAX_REASON_LENGTH),
    notes: trimmedNullableString(MAX_NOTES_LENGTH),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.startsAt instanceof Date &&
      value.endsAt instanceof Date &&
      value.endsAt.getTime() <= value.startsAt.getTime()
    ) {
      context.addIssue({
        code: "custom",
        path: ["endsAt"],
        message:
          "La date de fin doit être postérieure à la date de début.",
      });
    }

    if (
      value.status === SubscriptionStatus.CANCELLED &&
      !value.reason
    ) {
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message:
          "Une raison est obligatoire pour annuler un abonnement.",
      });
    }
  });

export type OrganizerPromotionsQueryInput = z.input<
  typeof organizerPromotionsQuerySchema
>;
export type OrganizerPromotionsQuery = z.output<
  typeof organizerPromotionsQuerySchema
>;
export type SubscriptionPlansQueryInput = z.input<
  typeof subscriptionPlansQuerySchema
>;
export type SubscriptionPlansQuery = z.output<
  typeof subscriptionPlansQuerySchema
>;
export type CreateOrganizerSubscriptionInput = z.input<
  typeof createOrganizerSubscriptionSchema
>;
export type CreateOrganizerSubscriptionData = z.output<
  typeof createOrganizerSubscriptionSchema
>;
export type ActivateOrganizerSubscriptionInput = z.input<
  typeof activateOrganizerSubscriptionSchema
>;
export type ActivateOrganizerSubscriptionData = z.output<
  typeof activateOrganizerSubscriptionSchema
>;
export type CancelOrganizerSubscriptionInput = z.input<
  typeof cancelOrganizerSubscriptionSchema
>;
export type CancelOrganizerSubscriptionData = z.output<
  typeof cancelOrganizerSubscriptionSchema
>;
export type RenewOrganizerSubscriptionInput = z.input<
  typeof renewOrganizerSubscriptionSchema
>;
export type RenewOrganizerSubscriptionData = z.output<
  typeof renewOrganizerSubscriptionSchema
>;
export type UpdateAutoRenewInput = z.input<
  typeof updateAutoRenewSchema
>;
export type UpdateAutoRenewData = z.output<
  typeof updateAutoRenewSchema
>;
export type AssignPromotedEventInput = z.input<
  typeof assignPromotedEventSchema
>;
export type AssignPromotedEventData = z.output<
  typeof assignPromotedEventSchema
>;
export type UpdatePromotedEventInput = z.input<
  typeof updatePromotedEventSchema
>;
export type UpdatePromotedEventData = z.output<
  typeof updatePromotedEventSchema
>;
export type RemovePromotedEventInput = z.input<
  typeof removePromotedEventSchema
>;
export type RemovePromotedEventData = z.output<
  typeof removePromotedEventSchema
>;
export type CreateSubscriptionPaymentInput = z.input<
  typeof createSubscriptionPaymentSchema
>;
export type CreateSubscriptionPaymentData = z.output<
  typeof createSubscriptionPaymentSchema
>;
export type UpdateSubscriptionPaymentInput = z.input<
  typeof updateSubscriptionPaymentSchema
>;
export type UpdateSubscriptionPaymentData = z.output<
  typeof updateSubscriptionPaymentSchema
>;
export type SubscriptionPaymentLookupInput = z.input<
  typeof subscriptionPaymentLookupSchema
>;
export type SubscriptionPaymentLookupData = z.output<
  typeof subscriptionPaymentLookupSchema
>;
export type PromotionPerformanceQueryInput = z.input<
  typeof promotionPerformanceQuerySchema
>;
export type PromotionPerformanceQuery = z.output<
  typeof promotionPerformanceQuerySchema
>;
export type PromotionHistoryQueryInput = z.input<
  typeof promotionHistoryQuerySchema
>;
export type PromotionHistoryQuery = z.output<
  typeof promotionHistoryQuerySchema
>;
export type PromotionWebhookInput = z.input<
  typeof promotionWebhookSchema
>;
export type PromotionWebhookData = z.output<
  typeof promotionWebhookSchema
>;
export type AdminUpdateSubscriptionInput = z.input<
  typeof adminUpdateSubscriptionSchema
>;
export type AdminUpdateSubscriptionData = z.output<
  typeof adminUpdateSubscriptionSchema
>;

export function formatPromotionValidationErrors(
  error: z.ZodError,
): Record<string, string[]> {
  const fields: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path =
      issue.path.length > 0
        ? issue.path.join(".")
        : "_form";

    if (!fields[path]) {
      fields[path] = [];
    }

    if (!fields[path].includes(issue.message)) {
      fields[path].push(issue.message);
    }
  }

  return fields;
}