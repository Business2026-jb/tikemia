import "server-only";

import {
  Prisma,
  PromoCodeStatus,
} from "@prisma/client";

import { calculateCouponDiscount } from "@/lib/coupons/calculate-coupon-discount";
import { CouponError } from "@/lib/coupons/coupon-errors";
import { normalizeCouponCode } from "@/lib/coupons/normalize-coupon-code";
import { prisma } from "@/lib/prisma";

export type IncrementCouponUsageInput = Readonly<{
  orderId: string;
  code: string;
}>;

export async function incrementCouponUsage(
  input: IncrementCouponUsageInput,
) {
  const orderId = input.orderId.trim();
  const code = normalizeCouponCode(input.code);

  if (!orderId) {
    throw new CouponError({
      code: "COUPON_ORDER_NOT_FOUND",
      message: "L’identifiant de la commande est obligatoire.",
      status: 400,
    });
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        const order = await tx.order.findUnique({
          where: {
            id: orderId,
          },
          select: {
            id: true,
            eventId: true,
            customerId: true,
            customerEmail: true,
            currency: true,
            subtotal: true,
            platformFee: true,
            status: true,
            paidAt: true,
          },
        });

        if (!order) {
          throw new CouponError({
            code: "COUPON_ORDER_NOT_FOUND",
            message: "Cette commande est introuvable.",
            status: 404,
          });
        }

        if (order.status !== "PAID" || !order.paidAt) {
          throw new CouponError({
            code: "COUPON_ORDER_NOT_ELIGIBLE",
            message:
              "Le compteur du code promo ne peut être augmenté qu’après confirmation du paiement.",
            status: 409,
          });
        }

        const existingUsage =
          await tx.promoCodeUsage.findFirst({
            where: {
              orderId: order.id,
            },
            select: {
              id: true,
              promoCodeId: true,
              discountAmount: true,
              currency: true,
            },
          });

        if (existingUsage) {
          return {
            created: false,
            usage: {
              ...existingUsage,
              discountAmount:
                existingUsage.discountAmount.toFixed(2),
            },
          };
        }

        const coupon = await tx.promoCode.findUnique({
          where: {
            eventId_code: {
              eventId: order.eventId,
              code,
            },
          },
          select: {
            id: true,
            eventId: true,
            discountType: true,
            discountValue: true,
            maximumDiscount: true,
            maximumUses: true,
            usesPerCustomer: true,
            currentUses: true,
            startsAt: true,
            expiresAt: true,
            status: true,
            isActive: true,
          },
        });

        if (!coupon) {
          throw new CouponError({
            code: "COUPON_NOT_FOUND",
            message: "Ce code promo est introuvable.",
            status: 404,
          });
        }

        const now = new Date();

        if (
          coupon.status !== PromoCodeStatus.ACTIVE ||
          !coupon.isActive ||
          (coupon.startsAt && coupon.startsAt > now) ||
          (coupon.expiresAt && coupon.expiresAt <= now)
        ) {
          throw new CouponError({
            code: "COUPON_NOT_ACTIVE",
            message:
              "Ce code promo n’est plus utilisable.",
            status: 409,
          });
        }

        if (
          coupon.maximumUses !== null &&
          coupon.currentUses >= coupon.maximumUses
        ) {
          throw new CouponError({
            code: "COUPON_USAGE_LIMIT_REACHED",
            message:
              "La limite d’utilisation de ce code promo est atteinte.",
            status: 409,
          });
        }

        if (coupon.usesPerCustomer !== null) {
          const customerUsageCount =
            await tx.promoCodeUsage.count({
              where: {
                promoCodeId: coupon.id,
                OR: [
                  ...(order.customerId
                    ? [{ customerId: order.customerId }]
                    : []),
                  {
                    customerEmail:
                      order.customerEmail.toLowerCase(),
                  },
                ],
              },
            });

          if (customerUsageCount >= coupon.usesPerCustomer) {
            throw new CouponError({
              code: "COUPON_CUSTOMER_LIMIT_REACHED",
              message:
                "La limite d’utilisation de ce code promo par client est atteinte.",
              status: 409,
            });
          }
        }

        const calculation = calculateCouponDiscount({
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          subtotal: order.subtotal,
          platformFee: order.platformFee,
          maximumDiscount: coupon.maximumDiscount,
        });

        const updated = await tx.promoCode.updateMany({
          where: {
            id: coupon.id,
            currentUses: coupon.currentUses,
            status: PromoCodeStatus.ACTIVE,
            isActive: true,
            ...(coupon.maximumUses !== null
              ? {
                  currentUses: {
                    lt: coupon.maximumUses,
                  },
                }
              : {}),
          },
          data: {
            currentUses: {
              increment: 1,
            },
          },
        });

        if (updated.count !== 1) {
          throw new CouponError({
            code: "COUPON_USAGE_LIMIT_REACHED",
            message:
              "Ce code promo vient d’atteindre sa limite d’utilisation.",
            status: 409,
          });
        }

        const usage = await tx.promoCodeUsage.create({
          data: {
            promoCodeId: coupon.id,
            orderId: order.id,
            customerId: order.customerId,
            customerEmail:
              order.customerEmail.toLowerCase(),
            discountAmount:
              calculation.discountAmount,
            currency: order.currency,
            usedAt: now,
          },
          select: {
            id: true,
            promoCodeId: true,
            orderId: true,
            customerId: true,
            customerEmail: true,
            discountAmount: true,
            currency: true,
            usedAt: true,
          },
        });

        return {
          created: true,
          usage: {
            ...usage,
            discountAmount:
              usage.discountAmount.toFixed(2),
          },
        };
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 15000,
      },
    );
  } catch (error) {
    if (error instanceof CouponError) {
      throw error;
    }

    throw new CouponError({
      code: "COUPON_USAGE_FAILED",
      message:
        "Impossible d’enregistrer l’utilisation du code promo.",
      status: 500,
      retryable: true,
      cause: error,
    });
  }
}
