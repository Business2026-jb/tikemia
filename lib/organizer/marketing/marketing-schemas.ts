import {
  MarketingCampaignStatus,
  MarketingChannel,
  MarketingGoalType,
  PromoCodeStatus,
  PromoDiscountType,
} from "@prisma/client";
import { z } from "zod";

export const DEFAULT_MARKETING_PAGE_SIZE = 20;
export const MAX_MARKETING_PAGE_SIZE = 100;
export const MAX_MARKETING_EXPORT_ROWS = 10_000;

const idSchema = z
  .string()
  .trim()
  .min(1, "L’identifiant est obligatoire.")
  .max(191, "L’identifiant est trop long.");

const optionalIdSchema = z.preprocess(
  emptyStringToNull,
  idSchema.nullable(),
);

const optionalDateSchema = z.preprocess(
  emptyStringToNull,
  z.coerce.date().nullable(),
);

const optionalNonNegativeNumberSchema = z.preprocess(
  emptyStringToNull,
  z.coerce
    .number()
    .finite("La valeur est invalide.")
    .min(0, "La valeur ne peut pas être négative.")
    .nullable(),
);

function emptyStringToNull(value: unknown): unknown {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized || null;
  }

  return value;
}

function normalizeBoolean(value: unknown): unknown {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["true", "1", "yes"].includes(normalized)) {
      return true;
    }

    if (["false", "0", "no"].includes(normalized)) {
      return false;
    }
  }

  if (value === 1) {
    return true;
  }

  if (value === 0) {
    return false;
  }

  return value;
}

function normalizePromoCode(value: unknown): unknown {
  return typeof value === "string"
    ? value.trim().toUpperCase().replace(/\s+/g, "")
    : value;
}

function normalizeCurrency(value: unknown): unknown {
  return typeof value === "string"
    ? value.trim().toUpperCase()
    : value;
}

function validateDateRange({
  startsAt,
  endsAt,
  context,
  endPath,
}: {
  startsAt?: Date | null;
  endsAt?: Date | null;
  context: z.RefinementCtx;
  endPath: string;
}) {
  if (
    startsAt &&
    endsAt &&
    endsAt.getTime() <= startsAt.getTime()
  ) {
    context.addIssue({
      code: "custom",
      path: [endPath],
      message:
        "La date de fin doit être postérieure à la date de début.",
    });
  }
}

export const currencyCodeSchema = z.preprocess(
  normalizeCurrency,
  z
    .string()
    .regex(
      /^[A-Z]{3}$/,
      "La devise doit contenir exactement trois lettres majuscules.",
    ),
);

export const marketingCampaignStatusSchema =
  z.nativeEnum(MarketingCampaignStatus);

export const marketingChannelSchema =
  z.nativeEnum(MarketingChannel);

export const marketingGoalTypeSchema =
  z.nativeEnum(MarketingGoalType);

export const promoCodeStatusSchema =
  z.nativeEnum(PromoCodeStatus);

export const promoDiscountTypeSchema =
  z.nativeEnum(PromoDiscountType);

export const marketingPeriodSchema = z.enum([
  "7d",
  "30d",
  "90d",
  "this_month",
  "last_month",
  "this_year",
  "custom",
]);

export const marketingMetricSchema = z.enum([
  "visits",
  "orders",
  "tickets",
  "revenue",
  "conversion",
]);

export const marketingGroupBySchema = z.enum([
  "day",
  "week",
  "month",
]);

export const marketingSortDirectionSchema = z.enum([
  "asc",
  "desc",
]);

export const campaignSortFieldSchema = z.enum([
  "createdAt",
  "updatedAt",
  "name",
  "startsAt",
  "endsAt",
  "budget",
  "status",
  "channel",
]);

export const promoCodeSortFieldSchema = z.enum([
  "createdAt",
  "updatedAt",
  "code",
  "startsAt",
  "expiresAt",
  "currentUses",
  "status",
  "discountValue",
]);

export const createMarketingCampaignSchema = z
  .object({
    eventId: idSchema,

    name: z
      .string()
      .trim()
      .min(
        2,
        "Le nom de la campagne doit contenir au moins 2 caractères.",
      )
      .max(
        120,
        "Le nom de la campagne ne peut pas dépasser 120 caractères.",
      ),

    description: z.preprocess(
      emptyStringToNull,
      z
        .string()
        .trim()
        .max(
          1_500,
          "La description ne peut pas dépasser 1 500 caractères.",
        )
        .nullable(),
    ),

    channel: marketingChannelSchema,

    status: marketingCampaignStatusSchema.default(
      MarketingCampaignStatus.DRAFT,
    ),

    source: z.preprocess(
      emptyStringToNull,
      z.string().trim().max(80).nullable(),
    ),

    medium: z.preprocess(
      emptyStringToNull,
      z.string().trim().max(80).nullable(),
    ),

    content: z.preprocess(
      emptyStringToNull,
      z.string().trim().max(180).nullable(),
    ),

    budget: optionalNonNegativeNumberSchema,

    currency: currencyCodeSchema.default("XOF"),

    goalType: z.preprocess(
      emptyStringToNull,
      marketingGoalTypeSchema.nullable(),
    ),

    goalValue: optionalNonNegativeNumberSchema,

    startsAt: optionalDateSchema,
    endsAt: optionalDateSchema,

    isActive: z
      .preprocess(normalizeBoolean, z.boolean())
      .default(true),
  })
  .strict()
  .superRefine((value, context) => {
    validateDateRange({
      startsAt: value.startsAt,
      endsAt: value.endsAt,
      context,
      endPath: "endsAt",
    });

    if (value.goalType && value.goalValue === null) {
      context.addIssue({
        code: "custom",
        path: ["goalValue"],
        message:
          "La valeur de l’objectif est obligatoire lorsqu’un objectif est sélectionné.",
      });
    }

    if (!value.goalType && value.goalValue !== null) {
      context.addIssue({
        code: "custom",
        path: ["goalType"],
        message:
          "Sélectionnez un type d’objectif.",
      });
    }

    if (
      value.goalType === MarketingGoalType.CONVERSION &&
      value.goalValue !== null &&
      value.goalValue > 100
    ) {
      context.addIssue({
        code: "custom",
        path: ["goalValue"],
        message:
          "Un objectif de conversion ne peut pas dépasser 100 %.",
      });
    }

    if (
      value.status === MarketingCampaignStatus.SCHEDULED &&
      !value.startsAt
    ) {
      context.addIssue({
        code: "custom",
        path: ["startsAt"],
        message:
          "Une campagne programmée doit avoir une date de début.",
      });
    }
  });

export const updateMarketingCampaignSchema = z
  .object({
    eventId: idSchema.optional(),
    name: z.string().trim().min(2).max(120).optional(),

    description: z
      .preprocess(
        emptyStringToNull,
        z.string().trim().max(1_500).nullable(),
      )
      .optional(),

    channel: marketingChannelSchema.optional(),
    status: marketingCampaignStatusSchema.optional(),

    source: z
      .preprocess(
        emptyStringToNull,
        z.string().trim().max(80).nullable(),
      )
      .optional(),

    medium: z
      .preprocess(
        emptyStringToNull,
        z.string().trim().max(80).nullable(),
      )
      .optional(),

    content: z
      .preprocess(
        emptyStringToNull,
        z.string().trim().max(180).nullable(),
      )
      .optional(),

    budget: optionalNonNegativeNumberSchema.optional(),
    currency: currencyCodeSchema.optional(),

    goalType: z
      .preprocess(
        emptyStringToNull,
        marketingGoalTypeSchema.nullable(),
      )
      .optional(),

    goalValue: optionalNonNegativeNumberSchema.optional(),

    startsAt: optionalDateSchema.optional(),
    endsAt: optionalDateSchema.optional(),

    isActive: z
      .preprocess(normalizeBoolean, z.boolean())
      .optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (Object.keys(value).length === 0) {
      context.addIssue({
        code: "custom",
        message:
          "Aucune donnée de campagne n’a été fournie.",
      });
    }

    validateDateRange({
      startsAt: value.startsAt,
      endsAt: value.endsAt,
      context,
      endPath: "endsAt",
    });

    if (
      value.goalType === MarketingGoalType.CONVERSION &&
      value.goalValue !== undefined &&
      value.goalValue !== null &&
      value.goalValue > 100
    ) {
      context.addIssue({
        code: "custom",
        path: ["goalValue"],
        message:
          "Un objectif de conversion ne peut pas dépasser 100 %.",
      });
    }
  });

export const campaignStatusUpdateSchema = z
  .object({
    status: marketingCampaignStatusSchema,
    isActive: z
      .preprocess(normalizeBoolean, z.boolean())
      .optional(),
  })
  .strict();

export const duplicateCampaignSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    startsAt: optionalDateSchema.optional(),
    endsAt: optionalDateSchema.optional(),
    status: marketingCampaignStatusSchema.default(
      MarketingCampaignStatus.DRAFT,
    ),
  })
  .strict()
  .superRefine((value, context) => {
    validateDateRange({
      startsAt: value.startsAt,
      endsAt: value.endsAt,
      context,
      endPath: "endsAt",
    });
  });

export const marketingCampaignQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),

    pageSize: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_MARKETING_PAGE_SIZE)
      .default(DEFAULT_MARKETING_PAGE_SIZE),

    search: z
      .preprocess(
        emptyStringToNull,
        z.string().trim().max(120).nullable(),
      )
      .optional(),

    eventId: optionalIdSchema.optional(),

    status: z
      .preprocess(
        emptyStringToNull,
        marketingCampaignStatusSchema.nullable(),
      )
      .optional(),

    channel: z
      .preprocess(
        emptyStringToNull,
        marketingChannelSchema.nullable(),
      )
      .optional(),

    period: marketingPeriodSchema.default("30d"),

    startsAt: optionalDateSchema.optional(),
    endsAt: optionalDateSchema.optional(),

    sortBy: campaignSortFieldSchema.default("createdAt"),

    sortDirection:
      marketingSortDirectionSchema.default("desc"),

    includeArchived: z
      .preprocess(normalizeBoolean, z.boolean())
      .default(false),
  })
  .strict()
  .superRefine((value, context) => {
    validateDateRange({
      startsAt: value.startsAt,
      endsAt: value.endsAt,
      context,
      endPath: "endsAt",
    });

    if (
      value.period === "custom" &&
      !value.startsAt &&
      !value.endsAt
    ) {
      context.addIssue({
        code: "custom",
        path: ["startsAt"],
        message:
          "Une période personnalisée doit contenir au moins une date.",
      });
    }
  });

export const createPromoCodeSchema = z
  .object({
    eventId: idSchema,
    campaignId: optionalIdSchema,

    code: z.preprocess(
      normalizePromoCode,
      z
        .string()
        .min(
          3,
          "Le code promo doit contenir au moins 3 caractères.",
        )
        .max(
          40,
          "Le code promo ne peut pas dépasser 40 caractères.",
        )
        .regex(
          /^[A-Z0-9_-]+$/,
          "Le code promo peut contenir uniquement des lettres, chiffres, tirets et underscores.",
        ),
    ),

    description: z.preprocess(
      emptyStringToNull,
      z.string().trim().max(1_000).nullable(),
    ),

    discountType: promoDiscountTypeSchema,

    discountValue: z.coerce
      .number()
      .finite()
      .positive(
        "La réduction doit être supérieure à zéro.",
      ),

    minimumOrderAmount:
      optionalNonNegativeNumberSchema,

    maximumDiscount:
      optionalNonNegativeNumberSchema,

    maximumUses: z.preprocess(
      emptyStringToNull,
      z.coerce.number().int().positive().nullable(),
    ),

    usesPerCustomer: z.preprocess(
      emptyStringToNull,
      z.coerce.number().int().positive().nullable(),
    ),

    startsAt: optionalDateSchema,
    expiresAt: optionalDateSchema,

    status: promoCodeStatusSchema.default(
      PromoCodeStatus.DRAFT,
    ),

    isActive: z
      .preprocess(normalizeBoolean, z.boolean())
      .default(true),
  })
  .strict()
  .superRefine((value, context) => {
    validateDateRange({
      startsAt: value.startsAt,
      endsAt: value.expiresAt,
      context,
      endPath: "expiresAt",
    });

    if (
      value.discountType ===
        PromoDiscountType.PERCENTAGE &&
      value.discountValue > 100
    ) {
      context.addIssue({
        code: "custom",
        path: ["discountValue"],
        message:
          "Une réduction en pourcentage ne peut pas dépasser 100 %.",
      });
    }

    if (
      value.maximumUses !== null &&
      value.usesPerCustomer !== null &&
      value.usesPerCustomer > value.maximumUses
    ) {
      context.addIssue({
        code: "custom",
        path: ["usesPerCustomer"],
        message:
          "La limite par client ne peut pas dépasser la limite totale.",
      });
    }

    if (
      value.status === PromoCodeStatus.SCHEDULED &&
      !value.startsAt
    ) {
      context.addIssue({
        code: "custom",
        path: ["startsAt"],
        message:
          "Un code promo programmé doit avoir une date de début.",
      });
    }
  });

export const updatePromoCodeSchema = z
  .object({
    eventId: idSchema.optional(),
    campaignId: optionalIdSchema.optional(),

    code: z
      .preprocess(
        normalizePromoCode,
        z
          .string()
          .min(3)
          .max(40)
          .regex(/^[A-Z0-9_-]+$/),
      )
      .optional(),

    description: z
      .preprocess(
        emptyStringToNull,
        z.string().trim().max(1_000).nullable(),
      )
      .optional(),

    discountType: promoDiscountTypeSchema.optional(),

    discountValue: z.coerce
      .number()
      .finite()
      .positive()
      .optional(),

    minimumOrderAmount:
      optionalNonNegativeNumberSchema.optional(),

    maximumDiscount:
      optionalNonNegativeNumberSchema.optional(),

    maximumUses: z
      .preprocess(
        emptyStringToNull,
        z.coerce.number().int().positive().nullable(),
      )
      .optional(),

    usesPerCustomer: z
      .preprocess(
        emptyStringToNull,
        z.coerce.number().int().positive().nullable(),
      )
      .optional(),

    startsAt: optionalDateSchema.optional(),
    expiresAt: optionalDateSchema.optional(),

    status: promoCodeStatusSchema.optional(),

    isActive: z
      .preprocess(normalizeBoolean, z.boolean())
      .optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (Object.keys(value).length === 0) {
      context.addIssue({
        code: "custom",
        message:
          "Aucune donnée de code promo n’a été fournie.",
      });
    }

    validateDateRange({
      startsAt: value.startsAt,
      endsAt: value.expiresAt,
      context,
      endPath: "expiresAt",
    });

    if (
      value.discountType ===
        PromoDiscountType.PERCENTAGE &&
      value.discountValue !== undefined &&
      value.discountValue > 100
    ) {
      context.addIssue({
        code: "custom",
        path: ["discountValue"],
        message:
          "Une réduction en pourcentage ne peut pas dépasser 100 %.",
      });
    }

    if (
      value.maximumUses !== undefined &&
      value.maximumUses !== null &&
      value.usesPerCustomer !== undefined &&
      value.usesPerCustomer !== null &&
      value.usesPerCustomer > value.maximumUses
    ) {
      context.addIssue({
        code: "custom",
        path: ["usesPerCustomer"],
        message:
          "La limite par client ne peut pas dépasser la limite totale.",
      });
    }
  });

export const promoCodeStatusUpdateSchema = z
  .object({
    status: promoCodeStatusSchema,
    isActive: z
      .preprocess(normalizeBoolean, z.boolean())
      .optional(),
  })
  .strict();

export const promoCodeQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),

    pageSize: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_MARKETING_PAGE_SIZE)
      .default(DEFAULT_MARKETING_PAGE_SIZE),

    search: z
      .preprocess(
        emptyStringToNull,
        z.string().trim().max(120).nullable(),
      )
      .optional(),

    eventId: optionalIdSchema.optional(),
    campaignId: optionalIdSchema.optional(),

    status: z
      .preprocess(
        emptyStringToNull,
        promoCodeStatusSchema.nullable(),
      )
      .optional(),

    discountType: z
      .preprocess(
        emptyStringToNull,
        promoDiscountTypeSchema.nullable(),
      )
      .optional(),

    startsAt: optionalDateSchema.optional(),
    endsAt: optionalDateSchema.optional(),

    sortBy: promoCodeSortFieldSchema.default("createdAt"),

    sortDirection:
      marketingSortDirectionSchema.default("desc"),

    includeArchived: z
      .preprocess(normalizeBoolean, z.boolean())
      .default(false),

    includeExpired: z
      .preprocess(normalizeBoolean, z.boolean())
      .default(true),
  })
  .strict()
  .superRefine((value, context) => {
    validateDateRange({
      startsAt: value.startsAt,
      endsAt: value.endsAt,
      context,
      endPath: "endsAt",
    });
  });

export const marketingPerformanceQuerySchema = z
  .object({
    eventId: optionalIdSchema.optional(),
    campaignId: optionalIdSchema.optional(),

    period: marketingPeriodSchema.default("30d"),

    startsAt: optionalDateSchema.optional(),
    endsAt: optionalDateSchema.optional(),

    metric: marketingMetricSchema.default("visits"),

    groupBy: marketingGroupBySchema.default("day"),

    channel: z
      .preprocess(
        emptyStringToNull,
        marketingChannelSchema.nullable(),
      )
      .optional(),
  })
  .strict()
  .superRefine((value, context) => {
    validateDateRange({
      startsAt: value.startsAt,
      endsAt: value.endsAt,
      context,
      endPath: "endsAt",
    });

    if (
      value.period === "custom" &&
      !value.startsAt &&
      !value.endsAt
    ) {
      context.addIssue({
        code: "custom",
        path: ["startsAt"],
        message:
          "Une période personnalisée doit contenir au moins une date.",
      });
    }
  });

export const marketingExportQuerySchema = z
  .object({
    type: z
      .enum([
        "campaigns",
        "promo_codes",
        "performance",
        "sources",
        "events",
      ])
      .default("campaigns"),

    format: z.enum(["csv", "xlsx"]).default("csv"),

    eventId: optionalIdSchema.optional(),
    campaignId: optionalIdSchema.optional(),

    startsAt: optionalDateSchema.optional(),
    endsAt: optionalDateSchema.optional(),

    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_MARKETING_EXPORT_ROWS)
      .default(MAX_MARKETING_EXPORT_ROWS),
  })
  .strict()
  .superRefine((value, context) => {
    validateDateRange({
      startsAt: value.startsAt,
      endsAt: value.endsAt,
      context,
      endPath: "endsAt",
    });
  });

export const validatePromoCodeSchema = z
  .object({
    code: z.preprocess(
      normalizePromoCode,
      z.string().min(3).max(40),
    ),

    eventId: idSchema,

    customerEmail: z
      .string()
      .trim()
      .email(
        "L’adresse e-mail du client est invalide.",
      )
      .max(254),

    orderAmount: z.coerce
      .number()
      .finite()
      .min(
        0,
        "Le montant de la commande ne peut pas être négatif.",
      ),

    currency: currencyCodeSchema,
  })
  .strict();

export type CreateMarketingCampaignInput = z.infer<
  typeof createMarketingCampaignSchema
>;

export type UpdateMarketingCampaignInput = z.infer<
  typeof updateMarketingCampaignSchema
>;

export type CampaignStatusUpdateInput = z.infer<
  typeof campaignStatusUpdateSchema
>;

export type DuplicateCampaignInput = z.infer<
  typeof duplicateCampaignSchema
>;

export type MarketingCampaignQueryInput = z.infer<
  typeof marketingCampaignQuerySchema
>;

export type CreatePromoCodeInput = z.infer<
  typeof createPromoCodeSchema
>;

export type UpdatePromoCodeInput = z.infer<
  typeof updatePromoCodeSchema
>;

export type PromoCodeStatusUpdateInput = z.infer<
  typeof promoCodeStatusUpdateSchema
>;

export type PromoCodeQueryInput = z.infer<
  typeof promoCodeQuerySchema
>;

export type MarketingPerformanceQueryInput = z.infer<
  typeof marketingPerformanceQuerySchema
>;

export type MarketingExportQueryInput = z.infer<
  typeof marketingExportQuerySchema
>;

export type ValidatePromoCodeInput = z.infer<
  typeof validatePromoCodeSchema
>;