import "server-only";

import {
  UserRole,
} from "@prisma/client";

import {
  normalizeCustomerEmail,
} from "@/lib/customer/normalize-customer-email";
import {
  normalizeCustomerPhone,
} from "@/lib/customer/normalize-customer-phone";
import {
  prisma,
} from "@/lib/prisma";

const DEFAULT_MAXIMUM_CANDIDATES =
  5_000;

const MAXIMUM_ALLOWED_CANDIDATES =
  20_000;

const MINIMUM_PHONE_SUFFIX_LENGTH =
  8;

export type LinkGuestOrdersToCustomerParams = {
  customerId: string;

  /**
   * Nombre maximal de commandes invitées pouvant être examinées
   * pendant une seule exécution.
   */
  maximumCandidates?: number;

  /**
   * Lorsque `true`, aucune écriture n’est effectuée.
   * La fonction retourne uniquement les correspondances trouvées.
   */
  dryRun?: boolean;
};

export type LinkGuestOrdersToCustomerMatchReason =
  | "EMAIL"
  | "PHONE"
  | "EMAIL_AND_PHONE";

export type LinkedGuestOrder = {
  id: string;
  reference: string;
  customerEmail: string;
  customerPhone: string;
  reason: LinkGuestOrdersToCustomerMatchReason;
};

export type LinkGuestOrdersToCustomerResult = {
  customerId: string;

  examinedOrders: number;
  matchedOrders: number;
  linkedOrders: number;

  linkedPromoCodeUsages: number;

  dryRun: boolean;
  truncated: boolean;

  matches: LinkedGuestOrder[];
};

export class LinkGuestOrdersToCustomerError extends Error {
  readonly code: string;
  readonly status: number;

  constructor({
    code,
    message,
    status = 500,
  }: {
    code: string;
    message: string;
    status?: number;
  }) {
    super(message);

    this.name =
      "LinkGuestOrdersToCustomerError";

    this.code =
      code;

    this.status =
      status;
  }
}

type CustomerIdentity = {
  id: string;

  firstName: string;
  lastName: string;

  email: string;
  phone: string;

  countryCode: string;
  dialCode: string;

  emailVerified: boolean;
  isActive: boolean;
};

type GuestOrderCandidate = {
  id: string;
  reference: string;

  customerName: string;
  customerEmail: string;
  customerPhone: string;
};

function normalizeText(
  value: string | null | undefined,
): string {
  return value?.trim() ?? "";
}

function normalizeMaximumCandidates(
  value: number | undefined,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return DEFAULT_MAXIMUM_CANDIDATES;
  }

  return Math.min(
    Math.max(
      Math.trunc(value),
      1,
    ),
    MAXIMUM_ALLOWED_CANDIDATES,
  );
}

function getPhoneDigits(
  value: string,
): string {
  return value.replace(/\D/g, "");
}

function getPhoneSuffix(
  value: string,
): string {
  const digits =
    getPhoneDigits(value);

  if (
    digits.length <
    MINIMUM_PHONE_SUFFIX_LENGTH
  ) {
    return "";
  }

  return digits.slice(
    -MINIMUM_PHONE_SUFFIX_LENGTH,
  );
}

function getCustomerFullName(
  customer: CustomerIdentity,
): string {
  return [
    customer.firstName,
    customer.lastName,
  ]
    .map(normalizeText)
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCustomerName(
  value: string | null | undefined,
): string {
  return normalizeText(value)
    .normalize("NFKC")
    .toLocaleLowerCase("fr")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function namesAreCompatible({
  orderName,
  customerName,
}: {
  orderName: string;
  customerName: string;
}): boolean {
  const normalizedOrderName =
    normalizeCustomerName(orderName);

  const normalizedCustomerName =
    normalizeCustomerName(customerName);

  if (
    !normalizedOrderName ||
    !normalizedCustomerName
  ) {
    return true;
  }

  return (
    normalizedOrderName ===
      normalizedCustomerName ||
    normalizedOrderName.includes(
      normalizedCustomerName,
    ) ||
    normalizedCustomerName.includes(
      normalizedOrderName,
    )
  );
}

function getMatchReason({
  emailMatches,
  phoneMatches,
}: {
  emailMatches: boolean;
  phoneMatches: boolean;
}): LinkGuestOrdersToCustomerMatchReason | null {
  if (
    emailMatches &&
    phoneMatches
  ) {
    return "EMAIL_AND_PHONE";
  }

  if (emailMatches) {
    return "EMAIL";
  }

  if (phoneMatches) {
    return "PHONE";
  }

  return null;
}

function mapMatchingOrders({
  candidates,
  customer,
}: {
  candidates: GuestOrderCandidate[];
  customer: CustomerIdentity;
}): LinkedGuestOrder[] {
  const normalizedCustomerEmail =
    normalizeCustomerEmail(
      customer.email,
    );

  const normalizedCustomerPhone =
    normalizeCustomerPhone(
      customer.phone,
      {
        countryCode:
          customer.countryCode,

        dialCode:
          customer.dialCode,
      },
    );

  const customerName =
    getCustomerFullName(
      customer,
    );

  return candidates.flatMap(
    (
      order,
    ) => {
      const emailMatches =
        normalizedCustomerEmail !== "" &&
        normalizeCustomerEmail(
          order.customerEmail,
        ) ===
          normalizedCustomerEmail;

      const phoneMatches =
        normalizedCustomerPhone !== "" &&
        normalizeCustomerPhone(
          order.customerPhone,
          {
            countryCode:
              customer.countryCode,

            dialCode:
              customer.dialCode,
          },
        ) ===
          normalizedCustomerPhone;

      const reason =
        getMatchReason({
          emailMatches,
          phoneMatches,
        });

      if (!reason) {
        return [];
      }

      /*
       * Le nom n’est jamais utilisé seul pour rattacher une commande.
       * Il sert uniquement de contrôle complémentaire lorsque les
       * coordonnées de la commande et du compte semblent correspondre.
       */
      if (
        !namesAreCompatible({
          orderName:
            order.customerName,

          customerName,
        })
      ) {
        return [];
      }

      return [
        {
          id:
            order.id,

          reference:
            order.reference,

          customerEmail:
            order.customerEmail,

          customerPhone:
            order.customerPhone,

          reason,
        },
      ];
    },
  );
}

async function loadCustomer(
  customerId: string,
): Promise<CustomerIdentity> {
  const customer =
    await prisma.user.findFirst({
      where: {
        id:
          customerId,

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

        countryCode:
          true,

        dialCode:
          true,

        emailVerified:
          true,

        isActive:
          true,
      },
    });

  if (!customer) {
    throw new LinkGuestOrdersToCustomerError({
      code:
        "CUSTOMER_NOT_FOUND",

      status:
        404,

      message:
        "Le compte client est introuvable.",
    });
  }

  if (
    !customer.isActive ||
    !customer.emailVerified
  ) {
    throw new LinkGuestOrdersToCustomerError({
      code:
        "CUSTOMER_NOT_ELIGIBLE",

      status:
        403,

      message:
        "Le compte client doit être actif et son adresse e-mail doit être vérifiée.",
    });
  }

  return customer;
}

async function loadGuestOrderCandidates({
  customer,
  maximumCandidates,
}: {
  customer: CustomerIdentity;
  maximumCandidates: number;
}): Promise<{
  candidates: GuestOrderCandidate[];
  truncated: boolean;
}> {
  const normalizedEmail =
    normalizeCustomerEmail(
      customer.email,
    );

  const normalizedPhone =
    normalizeCustomerPhone(
      customer.phone,
      {
        countryCode:
          customer.countryCode,

        dialCode:
          customer.dialCode,
      },
    );

  const phoneSuffix =
    getPhoneSuffix(
      normalizedPhone,
    );

  if (
    !normalizedEmail &&
    !phoneSuffix
  ) {
    return {
      candidates: [],
      truncated: false,
    };
  }

  const whereCandidates: Array<{
    customerEmail?: {
      equals: string;
      mode: "insensitive";
    };
    customerPhone?: {
      contains: string;
    };
  }> = [];

  if (normalizedEmail) {
    whereCandidates.push({
      customerEmail: {
        equals:
          normalizedEmail,

        mode:
          "insensitive",
      },
    });
  }

  if (phoneSuffix) {
    whereCandidates.push({
      customerPhone: {
        contains:
          phoneSuffix,
      },
    });
  }

  const rows =
    await prisma.order.findMany({
      where: {
        customerId:
          null,

        OR:
          whereCandidates,
      },

      orderBy: {
        createdAt:
          "desc",
      },

      take:
        maximumCandidates + 1,

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
      },
    });

  return {
    candidates:
      rows.slice(
        0,
        maximumCandidates,
      ),

    truncated:
      rows.length >
      maximumCandidates,
  };
}

/**
 * Rattache les anciennes commandes invitées au compte d’un client.
 *
 * Règles de sécurité :
 *
 * - le compte doit être CUSTOMER, actif et vérifié ;
 * - seules les commandes dont `customerId` est encore `null` sont ciblées ;
 * - une correspondance par e-mail vérifié ou téléphone normalisé est requise ;
 * - le nom n’est jamais une preuve suffisante à lui seul ;
 * - `updateMany` protège contre les rattachements concurrents.
 */
export async function linkGuestOrdersToCustomer({
  customerId,
  maximumCandidates,
  dryRun = false,
}: LinkGuestOrdersToCustomerParams): Promise<LinkGuestOrdersToCustomerResult> {
  const normalizedCustomerId =
    normalizeText(
      customerId,
    );

  if (!normalizedCustomerId) {
    throw new LinkGuestOrdersToCustomerError({
      code:
        "CUSTOMER_ID_REQUIRED",

      status:
        400,

      message:
        "L’identifiant du client est obligatoire.",
    });
  }

  const normalizedMaximumCandidates =
    normalizeMaximumCandidates(
      maximumCandidates,
    );

  try {
    const customer =
      await loadCustomer(
        normalizedCustomerId,
      );

    const {
      candidates,
      truncated,
    } =
      await loadGuestOrderCandidates({
        customer,
        maximumCandidates:
          normalizedMaximumCandidates,
      });

    const matches =
      mapMatchingOrders({
        candidates,
        customer,
      });

    if (
      dryRun ||
      matches.length === 0
    ) {
      return {
        customerId:
          customer.id,

        examinedOrders:
          candidates.length,

        matchedOrders:
          matches.length,

        linkedOrders:
          0,

        linkedPromoCodeUsages:
          0,

        dryRun,
        truncated,

        matches,
      };
    }

    const orderIds =
      matches.map(
        (
          match,
        ) =>
          match.id,
      );

    const result =
      await prisma.$transaction(
        async (
          transaction,
        ) => {
          const linkedOrders =
            await transaction.order.updateMany({
              where: {
                id: {
                  in:
                    orderIds,
                },

                customerId:
                  null,
              },

              data: {
                customerId:
                  customer.id,
              },
            });

          const linkedPromoCodeUsages =
            await transaction.promoCodeUsage.updateMany({
              where: {
                orderId: {
                  in:
                    orderIds,
                },

                customerId:
                  null,
              },

              data: {
                customerId:
                  customer.id,
              },
            });

          return {
            linkedOrders:
              linkedOrders.count,

            linkedPromoCodeUsages:
              linkedPromoCodeUsages.count,
          };
        },
      );

    return {
      customerId:
        customer.id,

      examinedOrders:
        candidates.length,

      matchedOrders:
        matches.length,

      linkedOrders:
        result.linkedOrders,

      linkedPromoCodeUsages:
        result.linkedPromoCodeUsages,

      dryRun:
        false,

      truncated,

      matches,
    };
  } catch (error) {
    if (
      error instanceof
      LinkGuestOrdersToCustomerError
    ) {
      throw error;
    }

    console.error(
      "[LINK_GUEST_ORDERS_TO_CUSTOMER_ERROR]",
      error instanceof Error
        ? {
            name:
              error.name,

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

    throw new LinkGuestOrdersToCustomerError({
      code:
        "LINK_GUEST_ORDERS_FAILED",

      status:
        500,

      message:
        "Impossible de rattacher les anciennes commandes au compte client pour le moment.",
    });
  }
}