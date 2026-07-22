import { createHash } from "node:crypto";

import {
  Prisma,
  PromoCodeStatus,
  PromoDiscountType,
} from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getOrganizerCoupons,
  GetOrganizerCouponsError,
  type GetOrganizerCouponsResult,
  type OrganizerCouponDateFilter,
  type OrganizerCouponSort,
} from "@/lib/organizer/get-organizer-coupons";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_REQUEST_SIZE_BYTES = 1_000_000;

type GetCouponsApiResponse = {
  success: boolean;
  message?: string;
  data?: GetOrganizerCouponsResult;
  code?: string;
  redirectTo?: string;
};

type CreateCouponData = {
  coupon: {
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
  };
};

type CreateCouponApiResponse = {
  success: boolean;
  message: string;
  data?: CreateCouponData;
  code?: string;
  fields?: Record<string, string[]>;
  redirectTo?: string;
};

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
    .max(1_000)
    .nullable()
    .optional(),
);

const nullableCuidSchema = z.preprocess(
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

const createCouponSchema = z
  .object({
    eventId: z
      .string()
      .trim()
      .min(
        1,
        "Sélectionnez un événement.",
      )
      .max(191),

    campaignId:
      nullableCuidSchema,

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
      ),

    description:
      nullableTextSchema,

    discountType:
      z.nativeEnum(
        PromoDiscountType,
      ),

    discountValue: z.preprocess(
      (value) => {
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
        ),
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
      .optional()
      .default(
        PromoCodeStatus.DRAFT,
      ),

    isActive: z
      .boolean()
      .optional(),
  })
  .superRefine(
    (value, context) => {
      if (
        value.discountType ===
          PromoDiscountType.PERCENTAGE &&
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

function parsePositiveInteger(
  value: string | null,
  fallback: number,
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) &&
    parsed > 0
    ? parsed
    : fallback;
}

function parseEnumValue<T extends string>(
  value: string | null,
  allowedValues: readonly T[],
): T | null {
  if (!value) {
    return null;
  }

  const normalized =
    value.trim().toUpperCase() as T;

  return allowedValues.includes(
    normalized,
  )
    ? normalized
    : null;
}

function parseStatusList(
  values: string[],
): PromoCodeStatus[] {
  const allowedValues =
    Object.values(
      PromoCodeStatus,
    );

  return Array.from(
    new Set(
      values
        .flatMap((value) =>
          value.split(","),
        )
        .map((value) =>
          value
            .trim()
            .toUpperCase(),
        )
        .filter(
          (
            value,
          ): value is PromoCodeStatus =>
            allowedValues.includes(
              value as PromoCodeStatus,
            ),
        ),
    ),
  );
}

function parseCouponSort(
  value: string | null,
): OrganizerCouponSort {
  const allowed:
    OrganizerCouponSort[] = [
      "recent",
      "oldest",
      "code-asc",
      "code-desc",
      "most-used",
      "least-used",
      "highest-discount",
      "lowest-discount",
    ];

  return allowed.includes(
    value as OrganizerCouponSort,
  )
    ? (value as OrganizerCouponSort)
    : "recent";
}

function parseDateFilter(
  value: string | null,
): OrganizerCouponDateFilter {
  const allowed:
    OrganizerCouponDateFilter[] = [
      "all",
      "active-now",
      "scheduled",
      "expired",
    ];

  return allowed.includes(
    value as OrganizerCouponDateFilter,
  )
    ? (value as OrganizerCouponDateFilter)
    : "all";
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
  isActive?: boolean;
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
    status === PromoCodeStatus.ACTIVE
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
      isActive:
        isActive ?? true,
    };
  }

  return {
    status,
    isActive: false,
  };
}

export async function GET(
  request: Request,
): Promise<NextResponse<GetCouponsApiResponse>> {
  try {
    const url = new URL(
      request.url,
    );

    const searchParams =
      url.searchParams;

    const page =
      parsePositiveInteger(
        searchParams.get(
          "page",
        ),
        DEFAULT_PAGE,
      );

    const requestedPageSize =
      parsePositiveInteger(
        searchParams.get(
          "pageSize",
        ),
        DEFAULT_PAGE_SIZE,
      );

    const pageSize =
      Math.min(
        requestedPageSize,
        MAX_PAGE_SIZE,
      );

    const rawStatus =
      searchParams.get(
        "status",
      );

    const status =
      parseEnumValue(
        rawStatus,
        Object.values(
          PromoCodeStatus,
        ),
      );

    if (
      rawStatus &&
      !status
    ) {
      return jsonResponse(
        {
          success: false,
          code:
            "INVALID_STATUS",
          message:
            "Le statut de code promo demandé n’est pas valide.",
        },
        400,
      );
    }

    const rawDiscountType =
      searchParams.get(
        "discountType",
      );

    const discountType =
      parseEnumValue(
        rawDiscountType,
        Object.values(
          PromoDiscountType,
        ),
      );

    if (
      rawDiscountType &&
      !discountType
    ) {
      return jsonResponse(
        {
          success: false,
          code:
            "INVALID_DISCOUNT_TYPE",
          message:
            "Le type de réduction demandé n’est pas valide.",
        },
        400,
      );
    }

    const result =
      await getOrganizerCoupons({
        page,
        pageSize,
        search:
          searchParams.get(
            "search",
          ) ??
          searchParams.get(
            "q",
          ),
        status,
        statuses:
          parseStatusList(
            searchParams.getAll(
              "statuses",
            ),
          ),
        eventId:
          searchParams.get(
            "eventId",
          ),
        campaignId:
          searchParams.get(
            "campaignId",
          ),
        discountType,
        currency:
          searchParams.get(
            "currency",
          ),
        dateFilter:
          parseDateFilter(
            searchParams.get(
              "dateFilter",
            ),
          ),
        from:
          searchParams.get(
            "from",
          ),
        to:
          searchParams.get(
            "to",
          ),
        sort:
          parseCouponSort(
            searchParams.get(
              "sort",
            ),
          ),
      });

    return jsonResponse(
      {
        success: true,
        data: result,
      },
      200,
    );
  } catch (error) {
    if (
      error instanceof
      GetOrganizerCouponsError
    ) {
      return jsonResponse(
        {
          success: false,
          code: error.code,
          message: error.message,
          redirectTo:
            error.status === 401
              ? "/organizer/login"
              : undefined,
        },
        error.status,
      );
    }

    console.error(
      "[ORGANIZER_COUPONS_GET_ROUTE_ERROR]",
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
          "Impossible de charger les codes promo pour le moment.",
      },
      500,
    );
  }
}

export async function POST(
  request: Request,
): Promise<NextResponse<CreateCouponApiResponse>> {
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

    let requestBody: unknown;

    try {
      requestBody =
        await request.json();
    } catch {
      return jsonResponse(
        {
          success: false,
          code: "INVALID_JSON",
          message:
            "Les informations envoyées ne sont pas valides.",
        },
        400,
      );
    }

    const validation =
      createCouponSchema.safeParse(
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

    const event =
      await prisma.event.findFirst({
        where: {
          id: input.eventId,
          organizerId:
            organizer.id,
        },
        select: {
          id: true,
          currency: true,
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

    if (input.campaignId) {
      const campaign =
        await prisma.marketingCampaign.findFirst({
          where: {
            id:
              input.campaignId,
            organizerId:
              organizer.id,
            eventId:
              input.eventId,
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

    const existingCoupon =
      await prisma.promoCode.findUnique({
        where: {
          eventId_code: {
            eventId:
              input.eventId,
            code: input.code,
          },
        },
        select: {
          id: true,
        },
      });

    if (existingCoupon) {
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

    const activeState =
      resolveActiveState({
        status:
          input.status,
        isActive:
          input.isActive,
        startsAt:
          input.startsAt ??
          null,
        expiresAt:
          input.expiresAt ??
          null,
      });

    const createdCoupon =
      await prisma.promoCode.create({
        data: {
          organizerId:
            organizer.id,
          eventId:
            input.eventId,
          campaignId:
            input.campaignId ??
            null,

          code: input.code,

          description:
            input.description ??
            null,

          discountType:
            input.discountType,

          discountValue:
            new Prisma.Decimal(
              input.discountValue,
            ),

          minimumOrderAmount:
            input.minimumOrderAmount ===
              null ||
            input.minimumOrderAmount ===
              undefined
              ? null
              : new Prisma.Decimal(
                  input.minimumOrderAmount,
                ),

          maximumDiscount:
            input.maximumDiscount ===
              null ||
            input.maximumDiscount ===
              undefined
              ? null
              : new Prisma.Decimal(
                  input.maximumDiscount,
                ),

          maximumUses:
            input.maximumUses ??
            null,

          usesPerCustomer:
            input.usesPerCustomer ??
            null,

          startsAt:
            input.startsAt ??
            null,

          expiresAt:
            input.expiresAt ??
            null,

          status:
            activeState.status,

          isActive:
            activeState.isActive,
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
        },
      });

    return jsonResponse(
      {
        success: true,
        message:
          activeState.status ===
            PromoCodeStatus.ACTIVE
            ? "Le code promo a été créé et activé."
            : activeState.status ===
                PromoCodeStatus.SCHEDULED
              ? "Le code promo a été créé et programmé."
              : "Le code promo a été créé comme brouillon.",
        data: {
          coupon: {
            id:
              createdCoupon.id,
            organizerId:
              createdCoupon.organizerId,
            eventId:
              createdCoupon.eventId,
            campaignId:
              createdCoupon.campaignId,
            code:
              createdCoupon.code,
            description:
              createdCoupon.description,
            discountType:
              createdCoupon.discountType,
            discountValue:
              createdCoupon.discountValue.toNumber(),
            minimumOrderAmount:
              createdCoupon.minimumOrderAmount
                ?.toNumber() ??
              null,
            maximumDiscount:
              createdCoupon.maximumDiscount
                ?.toNumber() ??
              null,
            maximumUses:
              createdCoupon.maximumUses,
            usesPerCustomer:
              createdCoupon.usesPerCustomer,
            currentUses:
              createdCoupon.currentUses,
            startsAt:
              createdCoupon.startsAt
                ?.toISOString() ??
              null,
            expiresAt:
              createdCoupon.expiresAt
                ?.toISOString() ??
              null,
            status:
              createdCoupon.status,
            isActive:
              createdCoupon.isActive,
            createdAt:
              createdCoupon.createdAt.toISOString(),
            updatedAt:
              createdCoupon.updatedAt.toISOString(),
          },
        },
        redirectTo:
          "/organizer/coupons",
      },
      201,
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
      "[ORGANIZER_COUPONS_POST_ROUTE_ERROR]",
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
          "Impossible de créer le code promo pour le moment. Réessayez.",
      },
      500,
    );
  }
}