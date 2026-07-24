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

const DEFAULT_MAXIMUM_TICKETS =
  10_000;

const MAXIMUM_ALLOWED_TICKETS =
  50_000;

export type LinkGuestTicketsToCustomerParams = {
  customerId: string;

  /**
   * Nombre maximal de billets pouvant être examinés en une seule
   * exécution.
   */
  maximumTickets?: number;

  /**
   * Lorsque `true`, aucune donnée n’est modifiée.
   */
  dryRun?: boolean;

  /**
   * Lorsque `true`, le nom, l’e-mail et le téléphone du détenteur
   * sont synchronisés avec le compte client lorsque cela est sûr.
   *
   * Le lien réel entre le billet et le client reste la relation :
   *
   * `Ticket -> Order -> customerId`
   *
   * car le modèle Ticket actuel ne possède pas de champ customerId.
   */
  synchronizeHolderData?: boolean;
};

export type GuestTicketLinkReason =
  | "ORDER_LINKED"
  | "ORDER_LINKED_AND_EMAIL_MATCH"
  | "ORDER_LINKED_AND_PHONE_MATCH"
  | "ORDER_LINKED_AND_EMAIL_PHONE_MATCH";

export type LinkedGuestTicket = {
  id: string;
  code: string;

  orderId: string;
  orderReference: string;

  holderName: string;
  holderEmail: string;
  holderPhone: string | null;

  reason: GuestTicketLinkReason;

  holderDataUpdated: boolean;
};

export type LinkGuestTicketsToCustomerResult = {
  customerId: string;

  examinedTickets: number;
  matchedTickets: number;
  updatedTickets: number;

  dryRun: boolean;
  truncated: boolean;

  tickets: LinkedGuestTicket[];
};

export class LinkGuestTicketsToCustomerError extends Error {
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
      "LinkGuestTicketsToCustomerError";

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

type TicketCandidate = {
  id: string;
  code: string;

  holderName: string;
  holderEmail: string;
  holderPhone: string | null;

  order: {
    id: string;
    reference: string;

    customerId: string | null;

    customerName: string;
    customerEmail: string;
    customerPhone: string;
  };
};

function normalizeText(
  value: string | null | undefined,
): string {
  return value?.trim() ?? "";
}

function normalizeMaximumTickets(
  value: number | undefined,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return DEFAULT_MAXIMUM_TICKETS;
  }

  return Math.min(
    Math.max(
      Math.trunc(value),
      1,
    ),
    MAXIMUM_ALLOWED_TICKETS,
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

function normalizePersonName(
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
  holderName,
  orderCustomerName,
  customerName,
}: {
  holderName: string;
  orderCustomerName: string;
  customerName: string;
}): boolean {
  const normalizedHolderName =
    normalizePersonName(holderName);

  const normalizedOrderCustomerName =
    normalizePersonName(
      orderCustomerName,
    );

  const normalizedCustomerName =
    normalizePersonName(customerName);

  if (!normalizedCustomerName) {
    return true;
  }

  const candidates = [
    normalizedHolderName,
    normalizedOrderCustomerName,
  ].filter(Boolean);

  if (candidates.length === 0) {
    return true;
  }

  return candidates.some(
    (candidate) =>
      candidate ===
        normalizedCustomerName ||
      candidate.includes(
        normalizedCustomerName,
      ) ||
      normalizedCustomerName.includes(
        candidate,
      ),
  );
}

function getLinkReason({
  emailMatches,
  phoneMatches,
}: {
  emailMatches: boolean;
  phoneMatches: boolean;
}): GuestTicketLinkReason {
  if (
    emailMatches &&
    phoneMatches
  ) {
    return "ORDER_LINKED_AND_EMAIL_PHONE_MATCH";
  }

  if (emailMatches) {
    return "ORDER_LINKED_AND_EMAIL_MATCH";
  }

  if (phoneMatches) {
    return "ORDER_LINKED_AND_PHONE_MATCH";
  }

  return "ORDER_LINKED";
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
    throw new LinkGuestTicketsToCustomerError({
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
    throw new LinkGuestTicketsToCustomerError({
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

async function loadTicketCandidates({
  customerId,
  maximumTickets,
}: {
  customerId: string;
  maximumTickets: number;
}): Promise<{
  tickets: TicketCandidate[];
  truncated: boolean;
}> {
  const rows =
    await prisma.ticket.findMany({
      where: {
        order: {
          customerId,
        },
      },

      orderBy: {
        createdAt:
          "desc",
      },

      take:
        maximumTickets + 1,

      select: {
        id:
          true,

        code:
          true,

        holderName:
          true,

        holderEmail:
          true,

        holderPhone:
          true,

        order: {
          select: {
            id:
              true,

            reference:
              true,

            customerId:
              true,

            customerName:
              true,

            customerEmail:
              true,

            customerPhone:
              true,
          },
        },
      },
    });

  return {
    tickets:
      rows.slice(
        0,
        maximumTickets,
      ),

    truncated:
      rows.length >
      maximumTickets,
  };
}

function mapTicketMatches({
  tickets,
  customer,
  synchronizeHolderData,
}: {
  tickets: TicketCandidate[];
  customer: CustomerIdentity;
  synchronizeHolderData: boolean;
}): LinkedGuestTicket[] {
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

  return tickets.map(
    (ticket) => {
      const normalizedHolderEmail =
        normalizeCustomerEmail(
          ticket.holderEmail,
        );

      const normalizedHolderPhone =
        normalizeCustomerPhone(
          ticket.holderPhone,
          {
            countryCode:
              customer.countryCode,

            dialCode:
              customer.dialCode,
          },
        );

      const normalizedOrderEmail =
        normalizeCustomerEmail(
          ticket.order.customerEmail,
        );

      const normalizedOrderPhone =
        normalizeCustomerPhone(
          ticket.order.customerPhone,
          {
            countryCode:
              customer.countryCode,

            dialCode:
              customer.dialCode,
          },
        );

      const emailMatches =
        normalizedCustomerEmail !== "" &&
        (
          normalizedHolderEmail ===
            normalizedCustomerEmail ||
          normalizedOrderEmail ===
            normalizedCustomerEmail
        );

      const phoneMatches =
        normalizedCustomerPhone !== "" &&
        (
          normalizedHolderPhone ===
            normalizedCustomerPhone ||
          normalizedOrderPhone ===
            normalizedCustomerPhone
        );

      const compatibleName =
        namesAreCompatible({
          holderName:
            ticket.holderName,

          orderCustomerName:
            ticket.order.customerName,

          customerName,
        });

      const holderDataUpdated =
        synchronizeHolderData &&
        compatibleName &&
        (
          emailMatches ||
          phoneMatches
        ) &&
        (
          normalizeText(
            ticket.holderName,
          ) !==
            customerName ||
          normalizeCustomerEmail(
            ticket.holderEmail,
          ) !==
            normalizedCustomerEmail ||
          normalizeCustomerPhone(
            ticket.holderPhone,
            {
              countryCode:
                customer.countryCode,

              dialCode:
                customer.dialCode,
            },
          ) !==
            normalizedCustomerPhone
        );

      return {
        id:
          ticket.id,

        code:
          ticket.code,

        orderId:
          ticket.order.id,

        orderReference:
          ticket.order.reference,

        holderName:
          ticket.holderName,

        holderEmail:
          ticket.holderEmail,

        holderPhone:
          ticket.holderPhone,

        reason:
          getLinkReason({
            emailMatches,
            phoneMatches,
          }),

        holderDataUpdated,
      };
    },
  );
}

/**
 * Rattache logiquement les billets invités à un compte client.
 *
 * Important :
 *
 * Le modèle Ticket actuel ne possède pas de champ `customerId`.
 * Le rattachement réel est donc fourni par la relation :
 *
 * `Ticket -> Order -> customerId`
 *
 * Cette fonction :
 *
 * - vérifie que les commandes des billets sont déjà rattachées au client ;
 * - retourne les billets désormais visibles dans l’espace client ;
 * - peut, de façon optionnelle, synchroniser les coordonnées du détenteur ;
 * - n’utilise jamais le nom seul comme preuve d’identité.
 */
export async function linkGuestTicketsToCustomer({
  customerId,
  maximumTickets,
  dryRun = false,
  synchronizeHolderData = true,
}: LinkGuestTicketsToCustomerParams): Promise<LinkGuestTicketsToCustomerResult> {
  const normalizedCustomerId =
    normalizeText(
      customerId,
    );

  if (!normalizedCustomerId) {
    throw new LinkGuestTicketsToCustomerError({
      code:
        "CUSTOMER_ID_REQUIRED",

      status:
        400,

      message:
        "L’identifiant du client est obligatoire.",
    });
  }

  const normalizedMaximumTickets =
    normalizeMaximumTickets(
      maximumTickets,
    );

  try {
    const customer =
      await loadCustomer(
        normalizedCustomerId,
      );

    const {
      tickets,
      truncated,
    } =
      await loadTicketCandidates({
        customerId:
          customer.id,

        maximumTickets:
          normalizedMaximumTickets,
      });

    const matches =
      mapTicketMatches({
        tickets,
        customer,
        synchronizeHolderData,
      });

    if (
      dryRun ||
      !synchronizeHolderData
    ) {
      return {
        customerId:
          customer.id,

        examinedTickets:
          tickets.length,

        matchedTickets:
          matches.length,

        updatedTickets:
          0,

        dryRun,
        truncated,

        tickets:
          matches,
      };
    }

    const customerName =
      getCustomerFullName(
        customer,
      ) ||
      "Client Tikemia";

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

    const ticketsToUpdate =
      matches.filter(
        (ticket) =>
          ticket.holderDataUpdated,
      );

    let updatedTickets =
      0;

    if (
      ticketsToUpdate.length >
      0
    ) {
      const updateResults =
        await prisma.$transaction(
          ticketsToUpdate.map(
            (ticket) =>
              prisma.ticket.updateMany({
                where: {
                  id:
                    ticket.id,

                  order: {
                    customerId:
                      customer.id,
                  },
                },

                data: {
                  holderName:
                    customerName,

                  holderEmail:
                    normalizedCustomerEmail ||
                    customer.email,

                  holderPhone:
                    normalizedCustomerPhone ||
                    null,
                },
              }),
          ),
        );

      updatedTickets =
        updateResults.reduce(
          (
            total,
            result,
          ) =>
            total +
            result.count,
          0,
        );
    }

    return {
      customerId:
        customer.id,

      examinedTickets:
        tickets.length,

      matchedTickets:
        matches.length,

      updatedTickets,

      dryRun:
        false,

      truncated,

      tickets:
        matches,
    };
  } catch (error) {
    if (
      error instanceof
      LinkGuestTicketsToCustomerError
    ) {
      throw error;
    }

    console.error(
      "[LINK_GUEST_TICKETS_TO_CUSTOMER_ERROR]",
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

    throw new LinkGuestTicketsToCustomerError({
      code:
        "LINK_GUEST_TICKETS_FAILED",

      status:
        500,

      message:
        "Impossible de rattacher les billets au compte client pour le moment.",
    });
  }
}