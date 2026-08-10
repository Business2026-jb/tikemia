import "server-only";

import { AdminPromotionError } from "@/lib/admin/promotions/admin-promotion-errors";
import { prisma } from "@/lib/prisma";

export async function getAdminPromotion(promotionId: string) {
  const id = promotionId.trim();

  if (!id) {
    throw new AdminPromotionError({
      code: "ADMIN_PROMOTION_ID_REQUIRED",
      message: "L’identifiant de la promotion est obligatoire.",
      status: 400,
    });
  }

  try {
    const boost = await prisma.eventBoost.findUnique({
      where: { id },
      include: {
        event: {
          include: {
            category: true,
          },
        },
        organizer: {
          include: {
            organizerProfile: true,
          },
        },
        subscription: {
          include: {
            plan: true,
            payments: {
              orderBy: { createdAt: "desc" },
              take: 50,
            },
          },
        },
      },
    });

    if (!boost) {
      throw new AdminPromotionError({
        code: "ADMIN_PROMOTION_NOT_FOUND",
        message: "Cette promotion est introuvable.",
        status: 404,
      });
    }

    const auditLogs = await prisma.adminAuditLog.findMany({
      where: {
        targetType: "EVENT_BOOST",
        targetId: boost.id,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        admin: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return {
      ...boost,
      organizer: {
        ...boost.organizer,
        fullName:
          `${boost.organizer.firstName} ${boost.organizer.lastName}`
            .replace(/\s+/g, " ")
            .trim(),
        profile: boost.organizer.organizerProfile,
      },
      subscription: boost.subscription
        ? {
            ...boost.subscription,
            plan: {
              ...boost.subscription.plan,
              price: boost.subscription.plan.price.toFixed(2),
            },
            payments: boost.subscription.payments.map((payment) => ({
              ...payment,
              amount: payment.amount.toFixed(2),
            })),
          }
        : null,
      auditLogs,
    };
  } catch (error) {
    if (error instanceof AdminPromotionError) throw error;

    throw new AdminPromotionError({
      code: "ADMIN_PROMOTION_QUERY_FAILED",
      message: "Impossible de charger le dossier de la promotion.",
      status: 500,
      cause: error,
    });
  }
}
