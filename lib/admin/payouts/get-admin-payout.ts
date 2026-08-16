import "server-only";

import {
  createDecipheriv,
  createHash,
} from "node\:crypto";

import {
  OrderStatus,
  Prisma,
  PayoutStatus,
} from "@prisma/client";

import {
  AdminPayoutError,
} from "@/lib/admin/payouts/admin-payout-errors";

import {
  prisma,
} from "@/lib/prisma";

/* =========================================================
 * CONFIGURATION
 * ======================================================= */

const PAYOUT_DESTINATION_ENCRYPTION_KEY_ENV_NAME =
  "PAYOUT_DESTINATION_ENCRYPTION_KEY";

const ENCRYPTION_VERSION =
  "v1";

const ENCRYPTION_ALGORITHM =
  "aes-256-gcm";

/* =========================================================
 * NORMALISATION
 * ======================================================= */

function normalizePayoutId(
  payoutId: string,
): string {
  const normalized =
    payoutId.trim();

  if (!normalized) {
    throw new AdminPayoutError({
      code:
        "ADMIN_PAYOUT_ID_REQUIRED",
      message:
        "L’identifiant de la demande de retrait est obligatoire.",
      status:
        400,
    });
  }

  return normalized;
}

function normalizeOptionalText(
  value:
    | string
    | null
    | undefined,
): string | null {
  const normalized =
    value?.trim() ?? "";

  return normalized || null;
}

/* =========================================================
 * ORGANIZER
 * ======================================================= */

function buildOrganizerFullName({
  firstName,
  lastName,
}: {
  firstName: string;
  lastName: string;
}): string {
  return `${firstName} ${lastName}`
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}

/* =========================================================
 * INFORMATION REQUEST
 * ======================================================= */

function extractInformationRequestMessage(
  adminNote:
    | string
    | null,
): string | null {
  if (
    !adminNote?.startsWith(
      "[INFORMATION_REQUIRED]",
    )
  ) {
    return null;
  }

  const message =
    adminNote
      .replace(
        "[INFORMATION_REQUIRED]",
        "",
      )
      .replace(
        /\[ADMIN:[^\]]+\]/g,
        "",
      )
      .replace(
        /\[DATE:[^\]]+\]/g,
        "",
      )
      .replace(
        /\s+/g,
        " ",
      )
      .trim();

  return message || null;
}

/* =========================================================
 * PAYOUT DESTINATION DECRYPTION
 * ======================================================= */

/**
 * Important:
 *
 * Cette fonction doit rester strictement compatible avec
 * encryptSensitiveValue() utilisé dans:
 *
 * app/api/organizer/payments/destinations/route.ts
 *
 * Chiffrement actuel:
 *
 * AES-256-GCM
 *
 * Format:
 *
 * v1.<iv base64url>.<authTag base64url>.<encrypted base64url>
 */

function getPayoutDestinationEncryptionKey():
  Buffer {
  const secret =
    process.env[
      PAYOUT_DESTINATION_ENCRYPTION_KEY_ENV_NAME
    ]?.trim();

  if (
    !secret ||
    secret.length < 32
  ) {
    throw new AdminPayoutError({
      code:
        "ADMIN_PAYOUT_QUERY_INVALID",
      message:
        "La clé de protection des informations de retrait n’est pas configurée.",
      status:
        500,
    });
  }

  return createHash(
    "sha256",
  )
    .update(
      secret,
    )
    .digest();
}

function decryptSensitiveValue(
  encryptedValue:
    | string
    | null
    | undefined,
): string | null {
  const normalized =
    normalizeOptionalText(
      encryptedValue,
    );

  if (!normalized) {
    return null;
  }

  const parts =
    normalized.split(".");

  if (
    parts.length !== 4
  ) {
    return null;
  }

  const [
    version,
    ivEncoded,
    authenticationTagEncoded,
    encryptedEncoded,
  ] = parts;

  if (
    version !==
    ENCRYPTION_VERSION
  ) {
    return null;
  }

  if (
    !ivEncoded ||
    !authenticationTagEncoded ||
    !encryptedEncoded
  ) {
    return null;
  }

  try {
    const key =
      getPayoutDestinationEncryptionKey();

    const iv =
      Buffer.from(
        ivEncoded,
        "base64url",
      );

    const authenticationTag =
      Buffer.from(
        authenticationTagEncoded,
        "base64url",
      );

    const encrypted =
      Buffer.from(
        encryptedEncoded,
        "base64url",
      );

    const decipher =
      createDecipheriv(
        ENCRYPTION_ALGORITHM,
        key,
        iv,
      );

    decipher.setAuthTag(
      authenticationTag,
    );

    const decrypted =
      Buffer.concat([
        decipher.update(
          encrypted,
        ),
        decipher.final(),
      ]);

    const value =
      decrypted
        .toString(
          "utf8",
        )
        .trim();

    return value || null;
  } catch (error) {
    console.error(
      "[ADMIN_PAYOUT_DESTINATION_DECRYPTION_ERROR]",
      error instanceof Error
        ? {
            name:
              error.name,
            message:
              error.message,
          }
        : error,
    );

    return null;
  }
}

/* =========================================================
 * DESTINATION DISPLAY HELPERS
 * ======================================================= */

function buildFullPhoneNumber({
  phoneCountryCode,
  phoneNumber,
}: {
  phoneCountryCode:
    | string
    | null;
  phoneNumber:
    | string
    | null;
}): string | null {
  if (!phoneNumber) {
    return null;
  }

  if (!phoneCountryCode) {
    return phoneNumber;
  }

  return `${phoneCountryCode} ${phoneNumber}`
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}

function buildMaskedPhoneNumber({
  phoneCountryCode,
  phoneNumberLast4,
}: {
  phoneCountryCode:
    | string
    | null;
  phoneNumberLast4:
    | string
    | null;
}): string | null {
  if (!phoneNumberLast4) {
    return null;
  }

  return [
    phoneCountryCode,
    `••••${phoneNumberLast4}`,
  ]
    .filter(Boolean)
    .join(" ");
}

function buildMaskedBankReference(
  last4:
    | string
    | null,
): string | null {
  if (!last4) {
    return null;
  }

  return `•••• •••• ${last4}`;
}

function buildMaskedCryptoAddress(
  last6:
    | string
    | null,
): string | null {
  if (!last6) {
    return null;
  }

  return `TRC20 ••••••${last6}`;
}

/* =========================================================
 * MAIN QUERY
 * ======================================================= */

export async function getAdminPayout(
  payoutId: string,
) {
  const id =
    normalizePayoutId(
      payoutId,
    );

  try {
    const payout =
      await prisma.payout.findUnique({
        where: {
          id,
        },

        select: {
          id:
            true,

          organizerId:
            true,

          amount:
            true,

          fee:
            true,

          netAmount:
            true,

          currency:
            true,

          status:
            true,

          reference:
            true,

          note:
            true,

          requestedAt:
            true,

          processedAt:
            true,

          createdAt:
            true,

          updatedAt:
            true,

          adminNote:
            true,

          destinationId:
            true,

          destinationSnapshot:
            true,

          destinationType:
            true,

          rejectionReason:
            true,

          organizer: {
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

              isActive:
                true,

              emailVerified:
                true,

              createdAt:
                true,

              organizerProfile: {
                select: {
                  businessName:
                    true,

                  logo:
                    true,

                  avatar:
                    true,

                  description:
                    true,
                },
              },

              organizerEvents: {
                orderBy: {
                  createdAt:
                    "desc",
                },

                take:
                  50,

                select: {
                  id:
                    true,

                  title:
                    true,

                  slug:
                    true,

                  status:
                    true,

                  startsAt:
                    true,

                  city:
                    true,

                  country:
                    true,

                  currency:
                    true,

                  orders: {
                    where: {
                      status:
                        OrderStatus.PAID,
                    },

                    select: {
                      total:
                        true,

                      platformFee:
                        true,
                    },
                  },
                },
              },
            },
          },

          destination: {
            select: {
              id:
                true,

              organizerId:
                true,

              type:
                true,

              status:
                true,

              country:
                true,

              countryCode:
                true,

              currency:
                true,

              accountName:
                true,

              mobileProvider:
                true,

              phoneCountryCode:
                true,

              /*
               * Version chiffrée complète.
               * Ne jamais envoyer directement cette valeur
               * au navigateur.
               */
              phoneNumberEncrypted:
                true,

              phoneNumberLast4:
                true,

              bankName:
                true,

              bankAccountNumberEncrypted:
                true,

              bankAccountNumberLast4:
                true,

              ibanEncrypted:
                true,

              ibanLast4:
                true,

              swiftBic:
                true,

              bankCode:
                true,

              branchCode:
                true,

              bankAddress:
                true,

              cryptoNetwork:
                true,

              cryptoAddressEncrypted:
                true,

              cryptoAddressLast6:
                true,

              isDefault:
                true,

              isActive:
                true,

              verifiedAt:
                true,

              rejectedAt:
                true,

              rejectionReason:
                true,

              createdAt:
                true,

              updatedAt:
                true,
            },
          },
        },
      });

    if (!payout) {
      throw new AdminPayoutError({
        code:
          "ADMIN_PAYOUT_NOT_FOUND",
        message:
          "Cette demande de retrait est introuvable.",
        status:
          404,
      });
    }

    /* =====================================================
     * EVENTS / REVENUE
     * =================================================== */

    const events =
      payout.organizer
        .organizerEvents
        .map(
          (
            event,
          ) => {
            const grossRevenue =
              event.orders.reduce(
                (
                  total,
                  order,
                ) =>
                  total.plus(
                    order.total,
                  ),
                new Prisma.Decimal(
                  0,
                ),
              );

            const platformFees =
              event.orders.reduce(
                (
                  total,
                  order,
                ) =>
                  total.plus(
                    order.platformFee,
                  ),
                new Prisma.Decimal(
                  0,
                ),
              );

            const estimatedNetRevenue =
              grossRevenue.minus(
                platformFees,
              );

            return {
              id:
                event.id,

              title:
                event.title,

              slug:
                event.slug,

              status:
                event.status,

              startsAt:
                event.startsAt,

              city:
                event.city,

              country:
                event.country,

              currency:
                event.currency,

              paidOrders:
                event.orders.length,

              grossRevenue:
                grossRevenue.toFixed(
                  2,
                ),

              platformFees:
                platformFees.toFixed(
                  2,
                ),

              estimatedNetRevenue:
                estimatedNetRevenue.toFixed(
                  2,
                ),
            };
          },
        );

    const totalGrossRevenue =
      events.reduce(
        (
          total,
          event,
        ) =>
          total.plus(
            event.grossRevenue,
          ),
        new Prisma.Decimal(
          0,
        ),
      );

    const totalPlatformFees =
      events.reduce(
        (
          total,
          event,
        ) =>
          total.plus(
            event.platformFees,
          ),
        new Prisma.Decimal(
          0,
        ),
      );

    const totalEstimatedNetRevenue =
      events.reduce(
        (
          total,
          event,
        ) =>
          total.plus(
            event.estimatedNetRevenue,
          ),
        new Prisma.Decimal(
          0,
        ),
      );

    /* =====================================================
     * DESTINATION DECRYPTION
     * =================================================== */

    const destination =
      payout.destination;

    const decryptedPhoneNumber =
      destination
        ? decryptSensitiveValue(
            destination
              .phoneNumberEncrypted,
          )
        : null;

    const decryptedBankAccountNumber =
      destination
        ? decryptSensitiveValue(
            destination
              .bankAccountNumberEncrypted,
          )
        : null;

    const decryptedIban =
      destination
        ? decryptSensitiveValue(
            destination
              .ibanEncrypted,
          )
        : null;

    const decryptedCryptoAddress =
      destination
        ? decryptSensitiveValue(
            destination
              .cryptoAddressEncrypted,
          )
        : null;

    const fullPhoneNumber =
      destination
        ? buildFullPhoneNumber({
            phoneCountryCode:
              destination.phoneCountryCode,

            phoneNumber:
              decryptedPhoneNumber,
          })
        : null;

    /* =====================================================
     * INFORMATION REQUEST
     * =================================================== */

    const informationRequestMessage =
      extractInformationRequestMessage(
        payout.adminNote,
      );

    /* =====================================================
     * FINAL SERIALIZATION
     * =================================================== */

    return {
      id:
        payout.id,

      organizerId:
        payout.organizerId,

      amount:
        payout.amount.toFixed(
          2,
        ),

      fee:
        payout.fee.toFixed(
          2,
        ),

      netAmount:
        payout.netAmount.toFixed(
          2,
        ),

      currency:
        payout.currency,

      status:
        payout.status,

      reference:
        payout.reference,

      note:
        payout.note,

      requestedAt:
        payout.requestedAt,

      processedAt:
        payout.processedAt,

      createdAt:
        payout.createdAt,

      updatedAt:
        payout.updatedAt,

      adminNote:
        payout.adminNote,

      destinationId:
        payout.destinationId,

      destinationSnapshot:
        payout.destinationSnapshot,

      destinationType:
        payout.destinationType,

      rejectionReason:
        payout.rejectionReason,

      /* ===================================================
       * ORGANIZER
       * ================================================= */

      organizer: {
        id:
          payout.organizer.id,

        firstName:
          payout.organizer.firstName,

        lastName:
          payout.organizer.lastName,

        fullName:
          buildOrganizerFullName({
            firstName:
              payout.organizer.firstName,

            lastName:
              payout.organizer.lastName,
          }),

        email:
          payout.organizer.email,

        phone:
          payout.organizer.phone,

        country:
          payout.organizer.country,

        countryCode:
          payout.organizer.countryCode,

        dialCode:
          payout.organizer.dialCode,

        isActive:
          payout.organizer.isActive,

        emailVerified:
          payout.organizer.emailVerified,

        createdAt:
          payout.organizer.createdAt,

        profile:
          payout.organizer
            .organizerProfile,
      },

      /* ===================================================
       * DESTINATION
       * ================================================= */

      destination:
        destination
          ? {
              id:
                destination.id,

              organizerId:
                destination.organizerId,

              type:
                destination.type,

              status:
                destination.status,

              country:
                destination.country,

              countryCode:
                destination.countryCode,

              currency:
                destination.currency,

              accountName:
                destination.accountName,

              mobileProvider:
                destination.mobileProvider,

              phoneCountryCode:
                destination.phoneCountryCode,

              /*
               * Informations Mobile Money.
               */

              phoneNumber:
                decryptedPhoneNumber,

              fullPhoneNumber,

              phoneNumberLast4:
                destination.phoneNumberLast4,

              maskedPhoneNumber:
                buildMaskedPhoneNumber({
                  phoneCountryCode:
                    destination
                      .phoneCountryCode,

                  phoneNumberLast4:
                    destination
                      .phoneNumberLast4,
                }),

              /*
               * Informations bancaires.
               */

              bankName:
                destination.bankName,

              bankAccountNumber:
                decryptedBankAccountNumber,

              bankAccountNumberLast4:
                destination
                  .bankAccountNumberLast4,

              maskedBankAccountNumber:
                buildMaskedBankReference(
                  destination
                    .bankAccountNumberLast4,
                ),

              iban:
                decryptedIban,

              ibanLast4:
                destination.ibanLast4,

              maskedIban:
                buildMaskedBankReference(
                  destination.ibanLast4,
                ),

              swiftBic:
                destination.swiftBic,

              bankCode:
                destination.bankCode,

              branchCode:
                destination.branchCode,

              bankAddress:
                destination.bankAddress,

              /*
               * Informations crypto.
               */

              cryptoNetwork:
                destination.cryptoNetwork,

              cryptoAddress:
                decryptedCryptoAddress,

              cryptoAddressLast6:
                destination
                  .cryptoAddressLast6,

              maskedCryptoAddress:
                buildMaskedCryptoAddress(
                  destination
                    .cryptoAddressLast6,
                ),

              /*
               * État.
               */

              isDefault:
                destination.isDefault,

              isActive:
                destination.isActive,

              verifiedAt:
                destination.verifiedAt,

              rejectedAt:
                destination.rejectedAt,

              rejectionReason:
                destination
                  .rejectionReason,

              createdAt:
                destination.createdAt,

              updatedAt:
                destination.updatedAt,

              /*
               * Permet à l'interface admin de savoir
               * immédiatement si les données sensibles
               * ont pu être récupérées.
               */

              sensitiveData: {
                phoneNumberAvailable:
                  Boolean(
                    decryptedPhoneNumber,
                  ),

                bankAccountNumberAvailable:
                  Boolean(
                    decryptedBankAccountNumber,
                  ),

                ibanAvailable:
                  Boolean(
                    decryptedIban,
                  ),

                cryptoAddressAvailable:
                  Boolean(
                    decryptedCryptoAddress,
                  ),
              },
            }
          : null,

      /* ===================================================
       * REVENUE SUMMARY
       * ================================================= */

      revenueSummary: {
        events,

        eventsCount:
          events.length,

        paidOrdersCount:
          events.reduce(
            (
              total,
              event,
            ) =>
              total +
              event.paidOrders,
            0,
          ),

        grossRevenue:
          totalGrossRevenue.toFixed(
            2,
          ),

        platformFees:
          totalPlatformFees.toFixed(
            2,
          ),

        estimatedNetRevenue:
          totalEstimatedNetRevenue.toFixed(
            2,
          ),
      },

      /* ===================================================
       * INFORMATION REQUEST
       * ================================================= */

      informationRequest:
        informationRequestMessage
          ? {
              pending:
                payout.status ===
                PayoutStatus.PENDING,

              message:
                informationRequestMessage,
            }
          : null,
    };
  } catch (error) {
    if (
      error instanceof
      AdminPayoutError
    ) {
      throw error;
    }

    console.error(
      "[ADMIN_GET_PAYOUT_ERROR]",
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

    throw new AdminPayoutError({
      code:
        "ADMIN_PAYOUT_QUERY_INVALID",

      message:
        "Impossible de charger le dossier de retrait.",

      status:
        500,

      cause:
        error,
    });
  }
}