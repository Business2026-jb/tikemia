import "server-only";

import { CouponError } from "@/lib/coupons/coupon-errors";
import { prisma } from "@/lib/prisma";

export type RemoveCouponFromOrderInput = Readonly<{
  orderId: string;
}>;

export async function removeCouponFromOrder(
  input: RemoveCouponFromOrderInput,
) {
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
        currency: true,
        subtotal: true,
        platformFee: true,
        total: true,
        status: true,
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
          "Le code promo ne peut plus être retiré de cette commande.",
        status: 409,
      });
    }

    /*
     * Aucun code promo provisoire n’est persisté sur Order dans le
     * schéma actuel. Retirer le coupon signifie donc revenir aux
     * montants d’origine enregistrés sur la commande.
     */
    return {
      order: {
        id: order.id,
        reference: order.reference,
        eventId: order.eventId,
        status: order.status,
      },
      coupon: null,
      amounts: {
        subtotal: order.subtotal.toFixed(2),
        platformFee: order.platformFee.toFixed(2),
        discountAmount: "0.00",
        discountedSubtotal: order.subtotal.toFixed(2),
        discountedPlatformFee: order.platformFee.toFixed(2),
        total: order.total.toFixed(2),
        currency: order.currency,
      },
    };
  } catch (error) {
    if (error instanceof CouponError) {
      throw error;
    }

    throw new CouponError({
      code: "COUPON_REMOVE_FAILED",
      message:
        "Impossible de retirer le code promo de cette commande.",
      status: 500,
      retryable: true,
      cause: error,
    });
  }
}
