import "server-only";

import { Prisma } from "@prisma/client";

import { CouponError } from "@/lib/coupons/coupon-errors";
import {
  validateCoupon,
  type ValidatedCoupon,
} from "@/lib/coupons/validate-coupon";
import { prisma } from "@/lib/prisma";

export type ApplyCouponToOrderInput = Readonly<{
  orderId: string;
  code: string;
}>;

export type AppliedCouponQuote = ValidatedCoupon &
  Readonly<{
    order: {
      id: string;
      reference: string;
      eventId: string;
      customerId: string | null;
      customerEmail: string;
      status: string;
    };
  }>;

export async function applyCouponToOrder(
  input: ApplyCouponToOrderInput,
): Promise<AppliedCouponQuote> {
  const orderId = input.orderId.trim();

  if (!orderId) {
    throw new CouponError({
      code: "COUPON_ORDER_NOT_FOUND",
      message: "L’identifiant de la commande est obligatoire.",
      status: 400,
    });
  }

  try {
    const order = await prisma.order.findUnique({
      where: {
        id: orderId,
      },
      select: {
        id: true,
        reference: true,
        eventId: true,
        customerId: true,
        customerEmail: true,
        currency: true,
        subtotal: true,
        platformFee: true,
        status: true,
        reservationExpiresAt: true,
      },
    });

    if (!order) {
      throw new CouponError({
        code: "COUPON_ORDER_NOT_FOUND",
        message: "Cette commande est introuvable.",
        status: 404,
      });
    }

    if (!["PENDING", "PROCESSING"].includes(order.status)) {
      throw new CouponError({
        code: "COUPON_ORDER_NOT_ELIGIBLE",
        message:
          "Un code promo ne peut plus être appliqué à cette commande.",
        status: 409,
      });
    }

    if (
      order.reservationExpiresAt &&
      order.reservationExpiresAt <= new Date()
    ) {
      throw new CouponError({
        code: "COUPON_ORDER_NOT_ELIGIBLE",
        message:
          "La réservation a expiré. Veuillez recommencer la commande.",
        status: 409,
      });
    }

    const validated = await validateCoupon({
      eventId: order.eventId,
      code: input.code,
      subtotal: order.subtotal,
      platformFee: order.platformFee,
      currency: order.currency,
      customerId: order.customerId,
      customerEmail: order.customerEmail,
      orderId: order.id,
    });

    /*
     * Le modèle Order actuel ne possède aucun champ promoCodeId,
     * discountAmount ou couponCode. Cette fonction produit donc une
     * proposition de prix fiable, recalculée côté serveur.
     *
     * La route de création du paiement devra envoyer ce coupon et
     * utiliser exactement les montants retournés, puis le webhook
     * appellera incrementCouponUsage après confirmation du paiement.
     */
    return {
      ...validated,
      order: {
        id: order.id,
        reference: order.reference,
        eventId: order.eventId,
        customerId: order.customerId,
        customerEmail: order.customerEmail,
        status: order.status,
      },
    };
  } catch (error) {
    if (error instanceof CouponError) {
      throw error;
    }

    throw new CouponError({
      code: "COUPON_APPLY_FAILED",
      message:
        "Impossible d’appliquer le code promo à cette commande.",
      status: 500,
      retryable: true,
      cause: error,
    });
  }
}
