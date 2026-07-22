import { createHash } from "node:crypto";

import {
  Prisma,
  PromoCodeStatus,
  PromoDiscountType,
} from "@prisma/client";
import { cookies } from "next/headers";
import {
  NextResponse,
  type NextRequest,
} from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_REQUEST_SIZE_BYTES = 1_000_000;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type ApiErrorResponse = {
  success: false;
  code: string;
  message: string;
  fields?: Record<string, string[]>;
  redirectTo?: string;
};

type CouponDetails = {
  id: string;
  organizerId: string;
  eventId: string;
  campaignId: string | null;

  code: string;
  description: string | null;

  discountType: PromoDiscountType;
  discountValue: number;

  minimumOrderAmount: number | null;
  maximumDiscount: number | null;

  maximumUses: number | null;
  usesPerCustomer: number | null;
  currentUses: number;

  startsAt: string | null;
  expiresAt: string | null;

  status: PromoCodeStatus;
  isActive: boolean;

  createdAt: string;
  updatedAt: string;

  currency: string;

  event: {
    id: string;
    title: string;
    slug: string;
    status: string;
    startsAt: string;
    endsAt: string;
    currency: string;
  };

  campaign: {
    id: string;
    name: string;
    status: string;
    trackingCode: string;
  } | null;

  performance: {
    usages: number;
    uniqueCustomers: number;
    discountsGranted: number;
    attributedOrders: number;
    attributedRevenue: number;
    ticketsGenerated: number;
    averageOrderValue: number;
    conversionRate: number;
  };
};

type GetCouponResponse =
  | {
      success: true;
      data: {
        coupon: CouponDetails;
      };
    }
  | ApiErrorResponse;

type UpdateCouponResponse =
  | {
      success: true;
      message: string;
      data: {
        coupon: CouponDetails;
      };
    }
  | ApiErrorResponse;

type DeleteCouponResponse =
  | {
      success: true;
      message: string;
      data: {
        id: string;
      };
      redirectTo: string;
    }
  | ApiErrorResponse;

type AuthenticatedOrganizer = {
  id: string;
};

const nullableTextSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const normalized = value.trim();

    return normalized.length > 0
      ? normalized
      : null;
  },
  z
    .string()
    .max(
      1_000,
      "La description ne peut pas dépasser 1 000 caractères.",
    )
    .nullable()
    .optional(),
);

const nullableIdSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const normalized = value.trim();

    return normalized.length > 0
      ? normalized
      : null;
  },
  z
    .string()
    .min(1)
    .max(191)
    .nullable()
    .optional(),
);

const nullableDateSchema = z.preprocess(
  (value) => {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return null;
    }

    if (value instanceof Date) {
      return value;
    }

    if (typeof value === "string") {
      const date = new Date(value);

      return Number.isNaN(date.getTime())
        ? value
        : date;
    }

    return value;
  },
  z
    .date({
      error:
        "La date renseignée n’est pas valide.",
    })
    .nullable()
    .optional(),
);

const nullablePositiveIntegerSchema =
  z.preprocess(
    (value) => {
      if (
        value === null ||
        value === undefined ||
        value === ""
      ) {
        return null;
      }

      if (typeof value === "string") {
        return Number(value);
      }

      return value;
    },
    z
      .number({
        error:
          "La valeur doit être un nombre.",
      })
      .int(
        "La valeur doit être un nombre entier.",
      )
      .positive(
        "La valeur doit être supérieure à zéro.",
      )
      .max(
        1_000_000,
        "La valeur renseignée est trop élevée.",
      )
      .nullable()
      .optional(),
  );

const nullableMoneySchema = z.preprocess(
  (value) => {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return null;
    }

    if (typeof value === "string") {
      return Number(
        value.replace(",", "."),
      );
    }

    return value;
  },
  z
    .number({
      error:
        "Le montant renseigné n’est pas valide.",
    })
    .nonnegative(
      "Le montant ne peut pas être négatif.",
    )
    .max(
      1_000_000_000_000,
      "Le montant renseigné est trop élevé.",
    )
    .nullable()
    .optional(),
);

const updateCouponSchema = z
  .object({
    eventId: z
      .string()
      .trim()
      .min(
        1,
        "Sélectionnez un événement.",
      )
      .max(191)
      .optional(),

    campaignId:
      nullableIdSchema,

    code: z
      .string()
      .trim()
      .min(
        3,
        "Le code promo doit contenir au moins 3 caractères.",
      )
      .max(
        40,
        "Le code promo ne peut pas dépasser 40 caractères.",
      )
      .regex(
        /^[A-Za-z0-9_-]+$/,
        "Utilisez uniquement des lettres, chiffres, tirets et underscores.",
      )
      .transform((value) =>
        value.toUpperCase(),
      )
      .optional(),

    description:
      nullableTextSchema,

    discountType:
      z.nativeEnum(
        PromoDiscountType,
      )
      .optional(),

    discountValue: z.preprocess(
      (value) => {
        if (
          value === undefined
        ) {
          return value;
        }

        if (typeof value === "string") {
          return Number(
            value.replace(",", "."),
          );
        }

        return value;
      },
      z
        .number({
          error:
            "La valeur de réduction n’est pas valide.",
        })
        .positive(
          "La réduction doit être supérieure à zéro.",
        )
        .max(
          1_000_000_000_000,
          "La réduction renseignée est trop élevée.",
        )
        .optional(),
    ),

    minimumOrderAmount:
      nullableMoneySchema,

    maximumDiscount:
      nullableMoneySchema,

    maximumUses:
      nullablePositiveIntegerSchema,

    usesPerCustomer:
      nullablePositiveIntegerSchema,

    startsAt:
      nullableDateSchema,

    expiresAt:
      nullableDateSchema,

    status: z
      .nativeEnum(
        PromoCodeStatus,
      )
      .optional(),

    isActive: z
      .boolean()
      .optional(),
  })
  .strict()
  .superRefine(
    (value, context) => {
      if (
        value.discountType ===
          PromoDiscountType.PERCENTAGE &&
        value.discountValue !==
          undefined &&
        value.discountValue > 100
      ) {
        context.addIssue({
          code:
            z.ZodIssueCode.custom,
          path: [
            "discountValue",
          ],
          message:
            "Une réduction en pourcentage ne peut pas dépasser 100 %.",
        });
      }

      if (
        value.startsAt &&
        value.expiresAt &&
        value.startsAt.getTime() >=
          value.expiresAt.getTime()
      ) {
        context.addIssue({
          code:
            z.ZodIssueCode.custom,
          path: [
            "expiresAt",
          ],
          message:
            "La date d’expiration doit être postérieure à la date de début.",
        });
      }

      if (
        value.maximumUses !==
          null &&
        value.maximumUses !==
          undefined &&
        value.usesPerCustomer !==
          null &&
        value.usesPerCustomer !==
          undefined &&
        value.usesPerCustomer >
          value.maximumUses
      ) {
        context.addIssue({
          code:
            z.ZodIssueCode.custom,
          path: [
            "usesPerCustomer",
          ],
          message:
            "La limite par client ne peut pas dépasser la limite totale.",
        });
      }
    },
  );

function noStoreHeaders(): HeadersInit {
  return {
    "Cache-Control":
      "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
  };
}

function jsonResponse<T extends object>(
  body: T,
  status: number,
): NextResponse<T> {
  return NextResponse.json(body, {
    status,
    headers: noStoreHeaders(),
  });
}

function hashSessionToken(
  token: string,
): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

function getRequestContentLength(
  request: Request,
): number | null {
  const value =
    request.headers.get(
      "content-length",
    );

  if (!value) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) &&
    parsed >= 0
    ? parsed
    : null;
}

function zodFields(
  error: z.ZodError,
): Record<string, string[]> {
  const flattened =
    error.flatten();

  return Object.fromEntries(
    Object.entries(
      flattened.fieldErrors,
    ).filter(
      (
        entry,
      ): entry is [
        string,
        string[],
      ] =>
        Array.isArray(entry[1]) &&
        entry[1].length > 0,
    ),
  );
}

function toNumber(
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

  if (
    typeof value === "number"
  ) {
    return Number.isFinite(value)
      ? value
      : 0;
  }

  if (
    typeof value === "string"
  ) {
    const parsed = Number(value);

    return Number.isFinite(parsed)
      ? parsed
      : 0;
  }

  return value.toNumber();
}

async function getAuthenticatedOrganizer(): Promise<AuthenticatedOrganizer | null> {
  const cookieStore =
    await cookies();

  const sessionCookieName =
    process.env.SESSION_COOKIE_NAME?.trim() ||
    "tikemia_session";

  const token =
    cookieStore.get(
      sessionCookieName,
    )?.value;

  if (!token) {
    return null;
  }

  const session =
    await prisma.session.findUnique({
      where: {
        tokenHash:
          hashSessionToken(token),
      },
      select: {
        id: true,
        expiresAt: true,
        user: {
          select: {
            id: true,
            role: true,
            isActive: true,
            emailVerified: true,
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
          id: session.id,
        },
      })
      .catch(() => undefined);

    return null;
  }

  if (
    session.user.role !==
      "ORGANIZER" ||
    !session.user.isActive ||
    !session.user.emailVerified
  ) {
    return null;
  }

  return {
    id: session.user.id,
  };
}

function resolveActiveState({
  status,
  isActive,
  startsAt,
  expiresAt,
}: {
  status: PromoCodeStatus;
  isActive: boolean;
  startsAt: Date | null;
  expiresAt: Date | null;
}): {
  status: PromoCodeStatus;
  isActive: boolean;
} {
  const now = Date.now();

  if (
    expiresAt &&
    expiresAt.getTime() <= now
  ) {
    return {
      status:
        PromoCodeStatus.EXPIRED,
      isActive: false,
    };
  }

  if (
    startsAt &&
    startsAt.getTime() > now &&
    status ===
      PromoCodeStatus.ACTIVE
  ) {
    return {
      status:
        PromoCodeStatus.SCHEDULED,
      isActive: false,
    };
  }

  if (
    status ===
      PromoCodeStatus.ACTIVE
  ) {
    return {
      status,
      isActive,
    };
  }

  return {
    status,
    isActive: false,
  };
}

async function findCouponForOrganizer({
  couponId,
  organizerId,
}: {
  couponId: string;
  organizerId: string;
}) {
  return prisma.promoCode.findFirst({
    where: {
      id: couponId,
      organizerId,
    },
    select: {
      id: true,
      organizerId: true,
      eventId: true,
      campaignId: true,

      code: true,
      description: true,

      discountType: true,
      discountValue: true,

      minimumOrderAmount: true,
      maximumDiscount: true,

      maximumUses: true,
      usesPerCustomer: true,
      currentUses: true,

      startsAt: true,
      expiresAt: true,

      status: true,
      isActive: true,

      createdAt: true,
      updatedAt: true,

      event: {
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          startsAt: true,
          endsAt: true,
          currency: true,
        },
      },

      campaign: {
        select: {
          id: true,
          name: true,
          status: true,
          trackingCode: true,
        },
      },

      usages: {
        select: {
          customerId: true,
          customerEmail: true,
          discountAmount: true,
          orderId: true,
        },
      },

      attributions: {
        select: {
          orderId: true,
          revenue: true,
          ticketsCount: true,
        },
      },
    },
  });
}

function normalizeCoupon(
  coupon: NonNullable<
    Awaited<
      ReturnType<
        typeof findCouponForOrganizer
      >
    >
  >,
): CouponDetails {
  const usages =
    coupon.usages.length;

  const uniqueCustomers =
    new Set(
      coupon.usages.map(
        (usage) =>
          usage.customerId ??
          usage.customerEmail,
      ),
    ).size;

  const discountsGranted =
    coupon.usages.reduce(
      (
        total,
        usage,
      ) =>
        total +
        toNumber(
          usage.discountAmount,
        ),
      0,
    );

  const attributedOrders =
    new Set(
      coupon.attributions.map(
        (attribution) =>
          attribution.orderId,
      ),
    ).size;

  const attributedRevenue =
    coupon.attributions.reduce(
      (
        total,
        attribution,
      ) =>
        total +
        toNumber(
          attribution.revenue,
        ),
      0,
    );

  const ticketsGenerated =
    coupon.attributions.reduce(
      (
        total,
        attribution,
      ) =>
        total +
        attribution.ticketsCount,
      0,
    );

  const averageOrderValue =
    attributedOrders > 0
      ? attributedRevenue /
        attributedOrders
      : 0;

  const conversionRate =
    usages > 0
      ? Math.min(
          100,
          (
            attributedOrders /
            usages
          ) *
            100,
        )
      : 0;

  return {
    id: coupon.id,
    organizerId:
      coupon.organizerId,
    eventId:
      coupon.eventId,
    campaignId:
      coupon.campaignId,

    code: coupon.code,
    description:
      coupon.description,

    discountType:
      coupon.discountType,

    discountValue:
      coupon.discountValue.toNumber(),

    minimumOrderAmount:
      coupon.minimumOrderAmount
        ?.toNumber() ??
      null,

    maximumDiscount:
      coupon.maximumDiscount
        ?.toNumber() ??
      null,

    maximumUses:
      coupon.maximumUses,

    usesPerCustomer:
      coupon.usesPerCustomer,

    currentUses:
      coupon.currentUses,

    startsAt:
      coupon.startsAt
        ?.toISOString() ??
      null,

    expiresAt:
      coupon.expiresAt
        ?.toISOString() ??
      null,

    status:
      coupon.status,

    isActive:
      coupon.isActive,

    createdAt:
      coupon.createdAt
        .toISOString(),

    updatedAt:
      coupon.updatedAt
        .toISOString(),

    currency:
      coupon.event.currency
        .trim()
        .toUpperCase() ||
      "XOF",

    event: {
      id:
        coupon.event.id,
      title:
        coupon.event.title,
      slug:
        coupon.event.slug,
      status:
        coupon.event.status,
      startsAt:
        coupon.event.startsAt
          .toISOString(),
      endsAt:
        coupon.event.endsAt
          ?.toISOString() ??
        "",
      currency:
        coupon.event.currency
          .trim()
          .toUpperCase() ||
        "XOF",
    },

    campaign:
      coupon.campaign
        ? {
            id:
              coupon.campaign.id,
            name:
              coupon.campaign.name,
            status:
              coupon.campaign.status,
            trackingCode:
              coupon.campaign
                .trackingCode,
          }
        : null,

    performance: {
      usages,
      uniqueCustomers,
      discountsGranted,
      attributedOrders,
      attributedRevenue,
      ticketsGenerated,
      averageOrderValue,
      conversionRate,
    },
  };
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse<GetCouponResponse>> {
  try {
    const organizer =
      await getAuthenticatedOrganizer();

    if (!organizer) {
      return jsonResponse(
        {
          success: false,
          code: "UNAUTHORIZED",
          message:
            "Votre session est absente, invalide ou expirée.",
          redirectTo:
            "/organizer/login",
        },
        401,
      );
    }

    const { id } =
      await context.params;

    if (!id?.trim()) {
      return jsonResponse(
        {
          success: false,
          code:
            "INVALID_COUPON_ID",
          message:
            "L’identifiant du code promo n’est pas valide.",
        },
        400,
      );
    }

    const coupon =
      await findCouponForOrganizer({
        couponId: id.trim(),
        organizerId:
          organizer.id,
      });

    if (!coupon) {
      return jsonResponse(
        {
          success: false,
          code:
            "COUPON_NOT_FOUND",
          message:
            "Ce code promo est introuvable ou ne vous appartient pas.",
        },
        404,
      );
    }

    return jsonResponse(
      {
        success: true,
        data: {
          coupon:
            normalizeCoupon(
              coupon,
            ),
        },
      },
      200,
    );
  } catch (error) {
    console.error(
      "[ORGANIZER_COUPON_GET_ROUTE_ERROR]",
      error instanceof Error
        ? {
            name: error.name,
            message:
              error.message,
            stack:
              process.env.NODE_ENV ===
              "development"
                ? error.stack
                : undefined,
          }
        : error,
    );

    return jsonResponse(
      {
        success: false,
        code:
          "INTERNAL_SERVER_ERROR",
        message:
          "Impossible de charger ce code promo pour le moment.",
      },
      500,
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse<UpdateCouponResponse>> {
  try {
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
      return jsonResponse(
        {
          success: false,
          code:
            "UNSUPPORTED_CONTENT_TYPE",
          message:
            "Le format de la requête n’est pas pris en charge.",
        },
        415,
      );
    }

    const contentLength =
      getRequestContentLength(
        request,
      );

    if (
      contentLength !== null &&
      contentLength >
        MAX_REQUEST_SIZE_BYTES
    ) {
      return jsonResponse(
        {
          success: false,
          code:
            "REQUEST_TOO_LARGE",
          message:
            "Les informations envoyées sont trop volumineuses.",
        },
        413,
      );
    }

    const organizer =
      await getAuthenticatedOrganizer();

    if (!organizer) {
      return jsonResponse(
        {
          success: false,
          code: "UNAUTHORIZED",
          message:
            "Votre session est absente, invalide ou expirée.",
          redirectTo:
            "/organizer/login",
        },
        401,
      );
    }

    const { id } =
      await context.params;

    if (!id?.trim()) {
      return jsonResponse(
        {
          success: false,
          code:
            "INVALID_COUPON_ID",
          message:
            "L’identifiant du code promo n’est pas valide.",
        },
        400,
      );
    }

    const existingCoupon =
      await prisma.promoCode.findFirst({
        where: {
          id: id.trim(),
          organizerId:
            organizer.id,
        },
        select: {
          id: true,
          eventId: true,
          campaignId: true,
          code: true,
          discountType: true,
          discountValue: true,
          maximumUses: true,
          usesPerCustomer: true,
          currentUses: true,
          startsAt: true,
          expiresAt: true,
          status: true,
          isActive: true,
        },
      });

    if (!existingCoupon) {
      return jsonResponse(
        {
          success: false,
          code:
            "COUPON_NOT_FOUND",
          message:
            "Ce code promo est introuvable ou ne vous appartient pas.",
        },
        404,
      );
    }

    let requestBody: unknown;

    try {
      requestBody =
        await request.json();
    } catch {
      return jsonResponse(
        {
          success: false,
          code:
            "INVALID_JSON",
          message:
            "Les informations envoyées ne sont pas valides.",
        },
        400,
      );
    }

    const validation =
      updateCouponSchema.safeParse(
        requestBody,
      );

    if (!validation.success) {
      return jsonResponse(
        {
          success: false,
          code:
            "VALIDATION_ERROR",
          message:
            validation.error.issues[0]
              ?.message ??
            "Vérifiez les informations du code promo.",
          fields:
            zodFields(
              validation.error,
            ),
        },
        400,
      );
    }

    const input =
      validation.data;

    if (
      Object.keys(input).length === 0
    ) {
      return jsonResponse(
        {
          success: false,
          code:
            "EMPTY_UPDATE",
          message:
            "Aucune modification n’a été envoyée.",
        },
        400,
      );
    }

    const nextEventId =
      input.eventId ??
      existingCoupon.eventId;

    const event =
      await prisma.event.findFirst({
        where: {
          id: nextEventId,
          organizerId:
            organizer.id,
        },
        select: {
          id: true,
        },
      });

    if (!event) {
      return jsonResponse(
        {
          success: false,
          code:
            "EVENT_NOT_FOUND",
          message:
            "L’événement sélectionné est introuvable ou ne vous appartient pas.",
          fields: {
            eventId: [
              "Sélectionnez un événement valide.",
            ],
          },
        },
        404,
      );
    }

    const nextCampaignId =
      input.campaignId ===
        undefined
        ? existingCoupon.campaignId
        : input.campaignId;

    if (nextCampaignId) {
      const campaign =
        await prisma.marketingCampaign.findFirst({
          where: {
            id:
              nextCampaignId,
            organizerId:
              organizer.id,
            eventId:
              nextEventId,
          },
          select: {
            id: true,
          },
        });

      if (!campaign) {
        return jsonResponse(
          {
            success: false,
            code:
              "CAMPAIGN_NOT_FOUND",
            message:
              "La campagne sélectionnée est introuvable, ne vous appartient pas ou n’est pas liée à cet événement.",
            fields: {
              campaignId: [
                "Sélectionnez une campagne valide pour cet événement.",
              ],
            },
          },
          404,
        );
      }
    }

    const nextCode =
      input.code ??
      existingCoupon.code;

    const duplicate =
      await prisma.promoCode.findFirst({
        where: {
          id: {
            not:
              existingCoupon.id,
          },
          eventId:
            nextEventId,
          code:
            nextCode,
        },
        select: {
          id: true,
        },
      });

    if (duplicate) {
      return jsonResponse(
        {
          success: false,
          code:
            "DUPLICATE_CODE",
          message:
            "Ce code promo existe déjà pour cet événement.",
          fields: {
            code: [
              "Choisissez un autre code promo.",
            ],
          },
        },
        409,
      );
    }

    const nextDiscountType =
      input.discountType ??
      existingCoupon.discountType;

    const nextDiscountValue =
      input.discountValue ??
      existingCoupon.discountValue.toNumber();

    if (
      nextDiscountType ===
        PromoDiscountType.PERCENTAGE &&
      nextDiscountValue > 100
    ) {
      return jsonResponse(
        {
          success: false,
          code:
            "INVALID_PERCENTAGE",
          message:
            "Une réduction en pourcentage ne peut pas dépasser 100 %.",
          fields: {
            discountValue: [
              "Le pourcentage ne peut pas dépasser 100 %.",
            ],
          },
        },
        400,
      );
    }

    const nextMaximumUses =
      input.maximumUses ===
        undefined
        ? existingCoupon.maximumUses
        : input.maximumUses;

    const nextUsesPerCustomer =
      input.usesPerCustomer ===
        undefined
        ? existingCoupon.usesPerCustomer
        : input.usesPerCustomer;

    if (
      nextMaximumUses !== null &&
      nextUsesPerCustomer !== null &&
      nextUsesPerCustomer >
        nextMaximumUses
    ) {
      return jsonResponse(
        {
          success: false,
          code:
            "INVALID_USAGE_LIMIT",
          message:
            "La limite par client ne peut pas dépasser la limite totale.",
          fields: {
            usesPerCustomer: [
              "La limite par client ne peut pas dépasser la limite totale.",
            ],
          },
        },
        400,
      );
    }

    if (
      nextMaximumUses !== null &&
      nextMaximumUses <
        existingCoupon.currentUses
    ) {
      return jsonResponse(
        {
          success: false,
          code:
            "MAXIMUM_USES_TOO_LOW",
          message:
            "La limite totale ne peut pas être inférieure au nombre d’utilisations déjà enregistrées.",
          fields: {
            maximumUses: [
              `Le code a déjà été utilisé ${existingCoupon.currentUses} fois.`,
            ],
          },
        },
        400,
      );
    }

    const nextStartsAt =
      input.startsAt ===
        undefined
        ? existingCoupon.startsAt
        : input.startsAt;

    const nextExpiresAt =
      input.expiresAt ===
        undefined
        ? existingCoupon.expiresAt
        : input.expiresAt;

    if (
      nextStartsAt &&
      nextExpiresAt &&
      nextStartsAt.getTime() >=
        nextExpiresAt.getTime()
    ) {
      return jsonResponse(
        {
          success: false,
          code:
            "INVALID_DATE_RANGE",
          message:
            "La date d’expiration doit être postérieure à la date de début.",
          fields: {
            expiresAt: [
              "Choisissez une date postérieure à la date de début.",
            ],
          },
        },
        400,
      );
    }

    const requestedStatus =
      input.status ??
      existingCoupon.status;

    const requestedIsActive =
      input.isActive ??
      existingCoupon.isActive;

    const activeState =
      resolveActiveState({
        status:
          requestedStatus,
        isActive:
          requestedIsActive,
        startsAt:
          nextStartsAt,
        expiresAt:
          nextExpiresAt,
      });

    await prisma.promoCode.update({
      where: {
        id:
          existingCoupon.id,
      },
      data: {
        ...(input.eventId !==
        undefined
          ? {
              eventId:
                nextEventId,
            }
          : {}),

        ...(input.campaignId !==
        undefined
          ? {
              campaignId:
                nextCampaignId,
            }
          : {}),

        ...(input.code !==
        undefined
          ? {
              code:
                nextCode,
            }
          : {}),

        ...(input.description !==
        undefined
          ? {
              description:
                input.description,
            }
          : {}),

        ...(input.discountType !==
        undefined
          ? {
              discountType:
                nextDiscountType,
            }
          : {}),

        ...(input.discountValue !==
        undefined
          ? {
              discountValue:
                new Prisma.Decimal(
                  nextDiscountValue,
                ),
            }
          : {}),

        ...(input.minimumOrderAmount !==
        undefined
          ? {
              minimumOrderAmount:
                input.minimumOrderAmount ===
                null
                  ? null
                  : new Prisma.Decimal(
                      input.minimumOrderAmount,
                    ),
            }
          : {}),

        ...(input.maximumDiscount !==
        undefined
          ? {
              maximumDiscount:
                input.maximumDiscount ===
                null
                  ? null
                  : new Prisma.Decimal(
                      input.maximumDiscount,
                    ),
            }
          : {}),

        ...(input.maximumUses !==
        undefined
          ? {
              maximumUses:
                nextMaximumUses,
            }
          : {}),

        ...(input.usesPerCustomer !==
        undefined
          ? {
              usesPerCustomer:
                nextUsesPerCustomer,
            }
          : {}),

        ...(input.startsAt !==
        undefined
          ? {
              startsAt:
                nextStartsAt,
            }
          : {}),

        ...(input.expiresAt !==
        undefined
          ? {
              expiresAt:
                nextExpiresAt,
            }
          : {}),

        status:
          activeState.status,

        isActive:
          activeState.isActive,
      },
    });

    const updatedCoupon =
      await findCouponForOrganizer({
        couponId:
          existingCoupon.id,
        organizerId:
          organizer.id,
      });

    if (!updatedCoupon) {
      return jsonResponse(
        {
          success: false,
          code:
            "COUPON_RELOAD_FAILED",
          message:
            "Le code promo a été modifié, mais son rechargement a échoué.",
        },
        500,
      );
    }

    return jsonResponse(
      {
        success: true,
        message:
          "Le code promo a été mis à jour.",
        data: {
          coupon:
            normalizeCoupon(
              updatedCoupon,
            ),
        },
      },
      200,
    );
  } catch (error) {
    if (
      error instanceof
      Prisma.PrismaClientKnownRequestError
    ) {
      if (
        error.code === "P2002"
      ) {
        return jsonResponse(
          {
            success: false,
            code:
              "DUPLICATE_CODE",
            message:
              "Ce code promo existe déjà pour cet événement.",
            fields: {
              code: [
                "Choisissez un autre code promo.",
              ],
            },
          },
          409,
        );
      }

      if (
        error.code === "P2003"
      ) {
        return jsonResponse(
          {
            success: false,
            code:
              "INVALID_RELATION",
            message:
              "L’événement ou la campagne sélectionnée n’est plus disponible.",
          },
          409,
        );
      }
    }

    console.error(
      "[ORGANIZER_COUPON_PATCH_ROUTE_ERROR]",
      error instanceof Error
        ? {
            name: error.name,
            message:
              error.message,
            stack:
              process.env.NODE_ENV ===
              "development"
                ? error.stack
                : undefined,
          }
        : error,
    );

    return jsonResponse(
      {
        success: false,
        code:
          "INTERNAL_SERVER_ERROR",
        message:
          "Impossible de modifier ce code promo pour le moment.",
      },
      500,
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse<DeleteCouponResponse>> {
  try {
    const organizer =
      await getAuthenticatedOrganizer();

    if (!organizer) {
      return jsonResponse(
        {
          success: false,
          code: "UNAUTHORIZED",
          message:
            "Votre session est absente, invalide ou expirée.",
          redirectTo:
            "/organizer/login",
        },
        401,
      );
    }

    const { id } =
      await context.params;

    if (!id?.trim()) {
      return jsonResponse(
        {
          success: false,
          code:
            "INVALID_COUPON_ID",
          message:
            "L’identifiant du code promo n’est pas valide.",
        },
        400,
      );
    }

    const coupon =
      await prisma.promoCode.findFirst({
        where: {
          id: id.trim(),
          organizerId:
            organizer.id,
        },
        select: {
          id: true,
          code: true,
          currentUses: true,
          _count: {
            select: {
              usages: true,
              attributions: true,
            },
          },
        },
      });

    if (!coupon) {
      return jsonResponse(
        {
          success: false,
          code:
            "COUPON_NOT_FOUND",
          message:
            "Ce code promo est introuvable ou ne vous appartient pas.",
        },
        404,
      );
    }

    if (
      coupon.currentUses > 0 ||
      coupon._count.usages > 0 ||
      coupon._count.attributions > 0
    ) {
      return jsonResponse(
        {
          success: false,
          code:
            "COUPON_HAS_HISTORY",
          message:
            "Ce code promo possède déjà un historique d’utilisation. Archivez-le au lieu de le supprimer.",
        },
        409,
      );
    }

    await prisma.promoCode.delete({
      where: {
        id: coupon.id,
      },
    });

    return jsonResponse(
      {
        success: true,
        message:
          `Le code promo « ${coupon.code} » a été supprimé.`,
        data: {
          id: coupon.id,
        },
        redirectTo:
          "/organizer/coupons",
      },
      200,
    );
  } catch (error) {
    if (
      error instanceof
      Prisma.PrismaClientKnownRequestError
    ) {
      if (
        error.code === "P2025"
      ) {
        return jsonResponse(
          {
            success: false,
            code:
              "COUPON_NOT_FOUND",
            message:
              "Ce code promo n’existe plus.",
          },
          404,
        );
      }

      if (
        error.code === "P2003"
      ) {
        return jsonResponse(
          {
            success: false,
            code:
              "COUPON_DELETE_BLOCKED",
            message:
              "Ce code promo est encore lié à des données existantes. Archivez-le au lieu de le supprimer.",
          },
          409,
        );
      }
    }

    console.error(
      "[ORGANIZER_COUPON_DELETE_ROUTE_ERROR]",
      error instanceof Error
        ? {
            name: error.name,
            message:
              error.message,
            stack:
              process.env.NODE_ENV ===
              "development"
                ? error.stack
                : undefined,
          }
        : error,
    );

    return jsonResponse(
      {
        success: false,
        code:
          "INTERNAL_SERVER_ERROR",
        message:
          "Impossible de supprimer ce code promo pour le moment.",
      },
      500,
    );
  }
}