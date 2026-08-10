import "server-only";

import {
  OrderStatus,
  Prisma,
  UserRole,
} from "@prisma/client";

import {
  AdminCustomerError,
} from "@/lib/admin/customers/customer-errors";
import {
  CUSTOMER_PURCHASE_STATUSES,
} from "@/lib/admin/customers/get-admin-customers";
import {
  prisma,
} from "@/lib/prisma";

export type AdminCustomerDetails = Readonly<{
  id: string;
  accountType: "REGISTERED" | "GUEST";
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  email: string;
  phone: string | null;
  country: string | null;
  countryCode: string | null;
  dialCode: string | null;
  emailVerified: boolean;
  isActive: boolean;
  registeredAt: Date | null;
  firstPurchaseAt: Date;
  lastPurchaseAt: Date;

  statistics: Readonly<{
    orders: number;
    paidOrders: number;
    refundedOrders: number;
    tickets: number;
    validTickets: number;
    usedTickets: number;
    totalSpentByCurrency: Readonly<
      Record<string, string>
    >;
  }>;

  recentOrders: readonly Readonly<{
    id: string;
    reference: string;
    status: OrderStatus;
    currency: string;
    subtotal: string;
    platformFee: string;
    total: string;
    paidAt: Date | null;
    createdAt: Date;

    event: Readonly<{
      id: string;
      title: string;
      slug: string;
      coverImage: string | null;
      venueName: string;
      city: string;
      country: string;
      startsAt: Date;
    }>;

    payment: Readonly<{
      provider: string;
      method: string;
      status: string;
      paidAt: Date | null;
    }> | null;

    ticketsCount: number;
  }>[];
}>;

function normalizeRequiredIdentifier(
  value: string,
): string {
  const normalized =
    value.trim();

  if (!normalized) {
    throw new AdminCustomerError({
      code:
        "ADMIN_CUSTOMER_ID_REQUIRED",

      message:
        "L’identifiant du client est obligatoire.",

      status:
        400,
    });
  }

  return normalized;
}

function decodeGuestEmail(
  identifier: string,
): string | null {
  if (
    !identifier.startsWith(
      "guest_",
    )
  ) {
    return null;
  }

  try {
    const encoded =
      identifier.slice(
        "guest_".length,
      );

    const email =
      Buffer.from(
        encoded,
        "base64url",
      )
        .toString(
          "utf8",
        )
        .trim()
        .toLowerCase();

    return email.includes(
      "@",
    )
      ? email
      : null;
  } catch {
    return null;
  }
}

export async function getAdminCustomer(
  customerId: string,
): Promise<AdminCustomerDetails> {
  const identifier =
    normalizeRequiredIdentifier(
      customerId,
    );

  const guestEmail =
    decodeGuestEmail(
      identifier,
    );

  let user:
    | {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
        country: string;
        countryCode: string;
        dialCode: string;
        emailVerified: boolean;
        isActive: boolean;
        createdAt: Date;
      }
    | null =
    null;

  if (!guestEmail) {
    user =
      await prisma.user.findFirst({
        where: {
          id:
            identifier,

          role:
            UserRole.CUSTOMER,
        },

        select: {
          id:
            true,

          firstName:
            true,

          lastName:
            true,

          email:
            true,

          phone:
            true,

          country:
            true,

          countryCode:
            true,

          dialCode:
            true,

          emailVerified:
            true,

          isActive:
            true,

          createdAt:
            true,
        },
      });
  }

  const email =
    user?.email
      .trim()
      .toLowerCase() ??
    guestEmail;

  if (!email) {
    throw new AdminCustomerError({
      code:
        "ADMIN_CUSTOMER_NOT_FOUND",

      message:
        "Ce client est introuvable.",

      status:
        404,
    });
  }

  const orderWhere:
    Prisma.OrderWhereInput = {
      status: {
        in: [
          ...CUSTOMER_PURCHASE_STATUSES,
        ],
      },

      OR: [
        {
          customerEmail: {
            equals:
              email,

            mode:
              "insensitive",
          },
        },

        ...(user
          ? [
              {
                customerId:
                  user.id,
              },
            ]
          : []),
      ],
    };

  const orders =
    await prisma.order.findMany({
      where:
        orderWhere,

      orderBy: [
        {
          paidAt:
            "desc",
        },
        {
          createdAt:
            "desc",
        },
      ],

      select: {
        id:
          true,

        reference:
          true,

        customerName:
          true,

        customerEmail:
          true,

        customerPhone:
          true,

        status:
          true,

        currency:
          true,

        subtotal:
          true,

        platformFee:
          true,

        total:
          true,

        paidAt:
          true,

        paymentConfirmedAt:
          true,

        createdAt:
          true,

        event: {
          select: {
            id:
              true,

            title:
              true,

            slug:
              true,

            coverImage:
              true,

            venueName:
              true,

            city:
              true,

            country:
              true,

            startsAt:
              true,
          },
        },

        payment: {
          select: {
            provider:
              true,

            method:
              true,

            status:
              true,

            paidAt:
              true,
          },
        },

        tickets: {
          select: {
            status:
              true,
          },
        },
      },
    });

  if (orders.length === 0) {
    throw new AdminCustomerError({
      code:
        "ADMIN_CUSTOMER_NOT_FOUND",

      message:
        "Aucun achat Tikemia n’a été trouvé pour ce client.",

      status:
        404,
    });
  }

  const firstOrder =
    orders.at(
      -1,
    )!;

  const latestOrder =
    orders[0]!;

  const firstPurchaseAt =
    firstOrder.paidAt ??
    firstOrder.paymentConfirmedAt ??
    firstOrder.createdAt;

  const lastPurchaseAt =
    latestOrder.paidAt ??
    latestOrder.paymentConfirmedAt ??
    latestOrder.createdAt;

  const guestName =
    latestOrder.customerName.trim() ||
    email;

  const totalSpentByCurrency =
    new Map<
      string,
      Prisma.Decimal
    >();

  let tickets =
    0;

  let validTickets =
    0;

  let usedTickets =
    0;

  for (const order of orders) {
    const current =
      totalSpentByCurrency.get(
        order.currency,
      ) ??
      new Prisma.Decimal(
        0,
      );

    totalSpentByCurrency.set(
      order.currency,
      current.plus(
        order.total,
      ),
    );

    tickets +=
      order.tickets.length;

    for (
      const ticket of order.tickets
    ) {
      if (
        ticket.status ===
        "VALID"
      ) {
        validTickets +=
          1;
      }

      if (
        ticket.status ===
        "USED"
      ) {
        usedTickets +=
          1;
      }
    }
  }

  const spentObject:
    Record<string, string> =
    {};

  for (
    const [
      currency,
      amount,
    ] of totalSpentByCurrency
  ) {
    spentObject[currency] =
      amount.toFixed(
        2,
      );
  }

  return {
    id:
      user?.id ??
      identifier,

    accountType:
      user
        ? "REGISTERED"
        : "GUEST",

    firstName:
      user?.firstName ??
      null,

    lastName:
      user?.lastName ??
      null,

    fullName:
      user
        ? `${user.firstName} ${user.lastName}`
            .replace(
              /\s+/g,
              " ",
            )
            .trim()
        : guestName,

    email:
      user?.email ??
      latestOrder.customerEmail,

    phone:
      user?.phone ??
      latestOrder.customerPhone ??
      null,

    country:
      user?.country ??
      null,

    countryCode:
      user?.countryCode ??
      null,

    dialCode:
      user?.dialCode ??
      null,

    emailVerified:
      user?.emailVerified ??
      false,

    isActive:
      user?.isActive ??
      true,

    registeredAt:
      user?.createdAt ??
      null,

    firstPurchaseAt,
    lastPurchaseAt,

    statistics: {
      orders:
        orders.length,

      paidOrders:
        orders.filter(
          (order) =>
            order.status ===
              OrderStatus.PAID ||
            order.status ===
              OrderStatus.PARTIALLY_REFUNDED,
        ).length,

      refundedOrders:
        orders.filter(
          (order) =>
            order.status ===
            OrderStatus.REFUNDED,
        ).length,

      tickets,
      validTickets,
      usedTickets,

      totalSpentByCurrency:
        spentObject,
    },

    recentOrders:
      orders.slice(
        0,
        20,
      ).map(
        (order) => ({
          id:
            order.id,

          reference:
            order.reference,

          status:
            order.status,

          currency:
            order.currency,

          subtotal:
            order.subtotal.toFixed(
              2,
            ),

          platformFee:
            order.platformFee.toFixed(
              2,
            ),

          total:
            order.total.toFixed(
              2,
            ),

          paidAt:
            order.paidAt,

          createdAt:
            order.createdAt,

          event:
            order.event,

          payment:
            order.payment
              ? {
                  provider:
                    order.payment.provider,

                  method:
                    order.payment.method,

                  status:
                    order.payment.status,

                  paidAt:
                    order.payment.paidAt,
                }
              : null,

          ticketsCount:
            order.tickets.length,
        }),
      ),
  };
}
