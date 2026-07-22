import {
  createHash,
  randomBytes,
} from "node:crypto";

import {
  OrganizerActivityType,
  PaymentStatus,
  PayoutDestinationStatus,
  PayoutDestinationType,
  PayoutStatus,
  Prisma,
} from "@prisma/client";
import { cookies } from "next/headers";
import {
  NextRequest,
  NextResponse,
} from "next/server";
import { z } from "zod";

import {
  sendPayoutRequestedEmail,
} from "@/lib/mail/send-payout-requested-email";
import {
  DEFAULT_CURRENCY_CODE,
  getCurrencyDefinition,
  isSupportedCurrencyCode,
  type SupportedCurrencyCode,
} from "@/lib/localization/currencies";
import {
  roundMoneyAmount,
} from "@/lib/localization/format-money";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SESSION_COOKIE_FALLBACK_NAME =
  "tikemia_session";

const DEFAULT_MINIMUM_PAYOUT_AMOUNT =
  5_000;

const DEFAULT_FIXED_PAYOUT_FEE =
  0;

const DEFAULT_PERCENTAGE_PAYOUT_FEE =
  0;

const DEFAULT_PROCESSING_DELAY_HOURS =
  24;

const MAXIMUM_NOTE_LENGTH =
  500;

const MAX_TRANSACTION_RETRIES =
  3;

const requestPayoutSchema =
  z.object({
    amount:
      z.coerce
        .number()
        .finite()
        .positive(),

    currency:
      z.string()
        .trim()
        .min(3)
        .max(10),

    note:
      z.string()
        .trim()
        .max(
          MAXIMUM_NOTE_LENGTH,
        )
        .nullable()
        .optional(),

    destinationId:
      z.string()
        .trim()
        .min(1)
        .max(191),

    destinationType:
      z.nativeEnum(
        PayoutDestinationType,
      ),
  })
    .strict();

type RequestPayoutInput =
  z.infer<
    typeof requestPayoutSchema
  >;

type ConnectedOrganizer = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  businessName: string | null;
};

type DestinationRecord = {
  id: string;
  organizerId: string;
  type: PayoutDestinationType;
  status: PayoutDestinationStatus;

  country: string;
  countryCode: string;
  currency: string;

  accountName: string;

  mobileProvider: string | null;
  phoneCountryCode: string | null;
  phoneNumberLast4: string | null;

  bankName: string | null;
  bankAccountNumberLast4: string | null;
  ibanLast4: string | null;

  cryptoNetwork: string | null;
  cryptoAddressLast6: string | null;

  isDefault: boolean;
  isActive: boolean;
};

type CreatedPayout = {
  id: string;
  reference: string | null;

  amount: Prisma.Decimal;
  fee: Prisma.Decimal;
  netAmount: Prisma.Decimal;

  currency: string;
  status: PayoutStatus;
  note: string | null;

  destinationId: string | null;
  destinationType: PayoutDestinationType | null;
  destinationSnapshot: Prisma.JsonValue | null;

  requestedAt: Date;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type TransactionResult = {
  payout: CreatedPayout;

  destination: DestinationRecord;

  availableBalanceBefore: number;
  availableBalanceAfter: number;
};

class RequestPayoutRouteError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor({
    code,
    message,
    status = 500,
    details,
  }: {
    code: string;
    message: string;
    status?: number;
    details?: unknown;
  }) {
    super(message);

    this.name =
      "RequestPayoutRouteError";

    this.code =
      code;

    this.status =
      status;

    this.details =
      details;
  }
}

function createErrorResponse({
  code,
  message,
  status,
  details,
}: {
  code: string;
  message: string;
  status: number;
  details?: unknown;
}) {
  return NextResponse.json(
    {
      success:
        false,

      error: {
        code,
        message,

        ...(details ===
        undefined
          ? {}
          : {
              details,
            }),
      },
    },
    {
      status,

      headers: {
        "Cache-Control":
          "no-store",

        "X-Content-Type-Options":
          "nosniff",
      },
    },
  );
}

function hashSessionToken(
  token: string,
): string {
  return createHash(
    "sha256",
  )
    .update(token)
    .digest("hex");
}

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string {
  return value?.trim() ?? "";
}

function normalizeOptionalText(
  value:
    | string
    | null
    | undefined,
): string | null {
  const normalized =
    normalizeText(value);

  return normalized || null;
}

function readNonNegativeEnvironmentNumber({
  name,
  fallback,
}: {
  name: string;
  fallback: number;
}): number {
  const raw =
    process.env[name];

  if (!raw?.trim()) {
    return fallback;
  }

  const parsed =
    Number(raw);

  return Number.isFinite(
    parsed,
  ) &&
    parsed >= 0
    ? parsed
    : fallback;
}

function readPositiveEnvironmentInteger({
  name,
  fallback,
}: {
  name: string;
  fallback: number;
}): number {
  const raw =
    process.env[name];

  if (!raw?.trim()) {
    return fallback;
  }

  const parsed =
    Number.parseInt(
      raw,
      10,
    );

  return Number.isFinite(
    parsed,
  ) &&
    parsed > 0
    ? parsed
    : fallback;
}

function normalizeCurrency(
  value: string,
): SupportedCurrencyCode {
  const normalized =
    value
      .trim()
      .toUpperCase();

  if (
    !isSupportedCurrencyCode(
      normalized,
    )
  ) {
    throw new RequestPayoutRouteError({
      code:
        "UNSUPPORTED_CURRENCY",

      status:
        400,

      message:
        "La devise sélectionnée n’est pas prise en charge.",
    });
  }

  const definition =
    getCurrencyDefinition(
      normalized,
    );

  if (!definition?.active) {
    throw new RequestPayoutRouteError({
      code:
        "INACTIVE_CURRENCY",

      status:
        400,

      message:
        "La devise sélectionnée n’est pas actuellement disponible pour les retraits.",
    });
  }

  return normalized;
}

function normalizeMoney(
  value: number,
  currency:
    SupportedCurrencyCode,
): number {
  if (
    !Number.isFinite(
      value,
    )
  ) {
    return 0;
  }

  return roundMoneyAmount({
    amount:
      value,

    currency,
  });
}

function decimalToNumber(
  value:
    | Prisma.Decimal
    | number,
): number {
  return typeof value ===
    "number"
    ? value
    : value.toNumber();
}

function calculatePayoutFee({
  amount,
  fixedFee,
  percentageFee,
  currency,
}: {
  amount: number;
  fixedFee: number;
  percentageFee: number;
  currency: SupportedCurrencyCode;
}): number {
  const percentageAmount =
    amount *
    (
      percentageFee /
      100
    );

  return normalizeMoney(
    Math.max(
      fixedFee +
        percentageAmount,
      0,
    ),
    currency,
  );
}

function createPayoutReference(): string {
  const timestamp =
    Date.now()
      .toString(36)
      .toUpperCase();

  const entropy =
    randomBytes(5)
      .toString("hex")
      .toUpperCase();

  return `PAY-${timestamp}-${entropy}`;
}

function isRetryableTransactionError(
  error: unknown,
): boolean {
  return (
    error instanceof
      Prisma.PrismaClientKnownRequestError &&
    error.code ===
      "P2034"
  );
}

function getMobileProviderLabel(
  provider:
    | string
    | null,
): string | null {
  if (!provider) {
    return null;
  }

  const labels:
    Record<
      string,
      string
    > = {
      MTN_MOMO:
        "MTN Mobile Money",

      MOOV_MONEY:
        "Moov Money",

      ORANGE_MONEY:
        "Orange Money",

      WAVE:
        "Wave",
    };

  return labels[provider] ??
    provider;
}

function buildDestinationLabel(
  destination:
    DestinationRecord,
): string {
  if (
    destination.type ===
    PayoutDestinationType.MOBILE_MONEY
  ) {
    return (
      getMobileProviderLabel(
        destination.mobileProvider,
      ) ??
      "Mobile Money"
    );
  }

  if (
    destination.type ===
    PayoutDestinationType.BANK_ACCOUNT
  ) {
    return (
      normalizeOptionalText(
        destination.bankName,
      ) ??
      "Compte bancaire"
    );
  }

  return "USDT TRC20";
}

function buildDestinationReference(
  destination:
    DestinationRecord,
): string {
  if (
    destination.type ===
    PayoutDestinationType.MOBILE_MONEY
  ) {
    const last4 =
      normalizeText(
        destination.phoneNumberLast4,
      );

    if (!last4) {
      return "Numéro masqué";
    }

    return [
      normalizeText(
        destination.phoneCountryCode,
      ),
      `••••${last4}`,
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (
    destination.type ===
    PayoutDestinationType.BANK_ACCOUNT
  ) {
    const last4 =
      normalizeText(
        destination.ibanLast4 ??
        destination.bankAccountNumberLast4,
      );

    return last4
      ? `•••• •••• ${last4}`
      : "Compte masqué";
  }

  const last6 =
    normalizeText(
      destination.cryptoAddressLast6,
    );

  return last6
    ? `TRC20 ••••••${last6}`
    : "Adresse masquée";
}

function buildDestinationSnapshot(
  destination:
    DestinationRecord,
): Prisma.InputJsonObject {
  return {
    destinationId:
      destination.id,

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

    label:
      buildDestinationLabel(
        destination,
      ),

    reference:
      buildDestinationReference(
        destination,
      ),

    mobileProvider:
      destination.mobileProvider,

    phoneCountryCode:
      destination.phoneCountryCode,

    phoneNumberLast4:
      destination.phoneNumberLast4,

    bankName:
      destination.bankName,

    bankAccountNumberLast4:
      destination.bankAccountNumberLast4,

    ibanLast4:
      destination.ibanLast4,

    cryptoNetwork:
      destination.cryptoNetwork,

    cryptoAddressLast6:
      destination.cryptoAddressLast6,

    isDefault:
      destination.isDefault,
  };
}

function serializePayout(
  payout:
    CreatedPayout,
) {
  return {
    id:
      payout.id,

    reference:
      payout.reference,

    amount:
      decimalToNumber(
        payout.amount,
      ),

    fee:
      decimalToNumber(
        payout.fee,
      ),

    netAmount:
      decimalToNumber(
        payout.netAmount,
      ),

    currency:
      payout.currency,

    status:
      payout.status,

    note:
      payout.note,

    destinationId:
      payout.destinationId,

    destinationType:
      payout.destinationType,

    destinationSnapshot:
      payout.destinationSnapshot,

    requestedAt:
      payout.requestedAt.toISOString(),

    processedAt:
      payout.processedAt?.toISOString() ??
      null,

    createdAt:
      payout.createdAt.toISOString(),

    updatedAt:
      payout.updatedAt.toISOString(),
  };
}

async function getConnectedOrganizer(): Promise<ConnectedOrganizer> {
  const cookieStore =
    await cookies();

  const sessionCookieName =
    process.env
      .SESSION_COOKIE_NAME
      ?.trim() ||
    SESSION_COOKIE_FALLBACK_NAME;

  const sessionToken =
    cookieStore.get(
      sessionCookieName,
    )?.value;

  if (!sessionToken) {
    throw new RequestPayoutRouteError({
      code:
        "UNAUTHENTICATED",

      status:
        401,

      message:
        "Votre session organisateur est introuvable. Veuillez vous reconnecter.",
    });
  }

  const session =
    await prisma.session.findUnique({
      where: {
        tokenHash:
          hashSessionToken(
            sessionToken,
          ),
      },

      select: {
        id:
          true,

        expiresAt:
          true,

        user: {
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

            role:
              true,

            emailVerified:
              true,

            isActive:
              true,

            organizerProfile: {
              select: {
                businessName:
                  true,
              },
            },
          },
        },
      },
    });

  if (!session) {
    throw new RequestPayoutRouteError({
      code:
        "SESSION_NOT_FOUND",

      status:
        401,

      message:
        "Votre session n’est plus valide. Veuillez vous reconnecter.",
    });
  }

  if (
    session.expiresAt.getTime() <=
    Date.now()
  ) {
    await prisma.session
      .delete({
        where: {
          id:
            session.id,
        },
      })
      .catch(
        (
          error: unknown,
        ) => {
          console.error(
            "[PAYOUT_REQUEST_EXPIRED_SESSION_DELETE_ERROR]",
            error instanceof Error
              ? error.message
              : error,
          );
        },
      );

    throw new RequestPayoutRouteError({
      code:
        "SESSION_EXPIRED",

      status:
        401,

      message:
        "Votre session a expiré. Veuillez vous reconnecter.",
    });
  }

  const organizer =
    session.user;

  if (
    organizer.role !==
      "ORGANIZER" ||
    !organizer.emailVerified ||
    !organizer.isActive
  ) {
    throw new RequestPayoutRouteError({
      code:
        "FORBIDDEN",

      status:
        403,

      message:
        "Ce compte n’est pas autorisé à demander un retrait.",
    });
  }

  return {
    id:
      organizer.id,

    firstName:
      organizer.firstName,

    lastName:
      organizer.lastName,

    email:
      organizer.email,

    phone:
      organizer.phone,

    businessName:
      organizer.organizerProfile
        ?.businessName ??
      null,
  };
}

async function readRequestBody(
  request:
    NextRequest,
): Promise<RequestPayoutInput> {
  let body: unknown;

  try {
    body =
      await request.json();
  } catch {
    throw new RequestPayoutRouteError({
      code:
        "INVALID_JSON",

      status:
        400,

      message:
        "Le contenu de la requête est invalide.",
    });
  }

  const parsed =
    requestPayoutSchema.safeParse(
      body,
    );

  if (!parsed.success) {
    throw new RequestPayoutRouteError({
      code:
        "INVALID_REQUEST",

      status:
        400,

      message:
        "Les informations du retrait sont invalides.",

      details:
        parsed.error.flatten(),
    });
  }

  return parsed.data;
}

async function findDestination({
  transaction,
  organizerId,
  destinationId,
  destinationType,
  currency,
}: {
  transaction:
    Prisma.TransactionClient;

  organizerId:
    string;

  destinationId:
    string;

  destinationType:
    PayoutDestinationType;

  currency:
    SupportedCurrencyCode;
}): Promise<DestinationRecord> {
  const destination =
    await transaction.payoutDestination.findFirst({
      where: {
        id:
          destinationId,

        organizerId,

        isActive:
          true,
      },

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

        phoneNumberLast4:
          true,

        bankName:
          true,

        bankAccountNumberLast4:
          true,

        ibanLast4:
          true,

        cryptoNetwork:
          true,

        cryptoAddressLast6:
          true,

        isDefault:
          true,

        isActive:
          true,
      },
    });

  if (!destination) {
    throw new RequestPayoutRouteError({
      code:
        "PAYOUT_DESTINATION_NOT_FOUND",

      status:
        404,

      message:
        "Le moyen de retrait sélectionné est introuvable ou n’est plus actif.",
    });
  }

  if (
    destination.type !==
    destinationType
  ) {
    throw new RequestPayoutRouteError({
      code:
        "PAYOUT_DESTINATION_TYPE_MISMATCH",

      status:
        400,

      message:
        "Le type du moyen de retrait ne correspond pas à la destination sélectionnée.",
    });
  }

  if (
    destination.status ===
      PayoutDestinationStatus.REJECTED ||
    destination.status ===
      PayoutDestinationStatus.DISABLED
  ) {
    throw new RequestPayoutRouteError({
      code:
        "PAYOUT_DESTINATION_UNAVAILABLE",

      status:
        422,

      message:
        "Le moyen de retrait sélectionné ne peut pas être utilisé.",
    });
  }

  if (
    destination.currency
      .trim()
      .toUpperCase() !==
    currency
  ) {
    throw new RequestPayoutRouteError({
      code:
        "PAYOUT_DESTINATION_CURRENCY_MISMATCH",

      status:
        422,

      message:
        "La devise du moyen de retrait ne correspond pas à la devise demandée.",
    });
  }

  return destination;
}

async function createPayoutInTransaction({
  organizer,
  amount,
  currency,
  note,
  destinationId,
  destinationType,
  fixedFee,
  percentageFee,
}: {
  organizer:
    ConnectedOrganizer;

  amount:
    number;

  currency:
    SupportedCurrencyCode;

  note:
    string | null;

  destinationId:
    string;

  destinationType:
    PayoutDestinationType;

  fixedFee:
    number;

  percentageFee:
    number;
}): Promise<TransactionResult> {
  for (
    let attempt = 1;
    attempt <=
      MAX_TRANSACTION_RETRIES;
    attempt += 1
  ) {
    try {
      return await prisma.$transaction(
        async (
          transaction,
        ) => {
          const destination =
            await findDestination({
              transaction,

              organizerId:
                organizer.id,

              destinationId,

              destinationType,

              currency,
            });

          const [
            successfulPayments,
            refundedPayments,
            existingPayouts,
            activePayout,
          ] =
            await Promise.all([
              transaction.payment.findMany({
                where: {
                  currency,

                  status:
                    PaymentStatus.SUCCESS,

                  order: {
                    event: {
                      organizerId:
                        organizer.id,
                    },
                  },
                },

                select: {
                  order: {
                    select: {
                      subtotal:
                        true,

                      platformFee:
                        true,
                    },
                  },
                },
              }),

              transaction.payment.findMany({
                where: {
                  currency,

                  status:
                    PaymentStatus.REFUNDED,

                  order: {
                    event: {
                      organizerId:
                        organizer.id,
                    },
                  },
                },

                select: {
                  amount:
                    true,
                },
              }),

              transaction.payout.findMany({
                where: {
                  organizerId:
                    organizer.id,

                  currency,
                },

                select: {
                  amount:
                    true,

                  status:
                    true,
                },
              }),

              transaction.payout.findFirst({
                where: {
                  organizerId:
                    organizer.id,

                  currency,

                  status: {
                    in: [
                      PayoutStatus.PENDING,
                      PayoutStatus.PROCESSING,
                    ],
                  },
                },

                select: {
                  id:
                    true,

                  reference:
                    true,

                  status:
                    true,
                },
              }),
            ]);

          if (activePayout) {
            throw new RequestPayoutRouteError({
              code:
                "ACTIVE_PAYOUT_EXISTS",

              status:
                409,

              message:
                "Une demande de retrait est déjà en attente ou en cours de traitement.",

              details: {
                payoutId:
                  activePayout.id,

                reference:
                  activePayout.reference,

                status:
                  activePayout.status,
              },
            });
          }

          const organizerNet =
            successfulPayments.reduce(
              (
                total,
                payment,
              ) => {
                const subtotal =
                  decimalToNumber(
                    payment.order.subtotal,
                  );

                const platformFeeAmount =
                  decimalToNumber(
                    payment.order.platformFee,
                  );

                return total +
                  Math.max(
                    subtotal -
                      platformFeeAmount,
                    0,
                  );
              },
              0,
            );

          const refundedAmount =
            refundedPayments.reduce(
              (
                total,
                payment,
              ) =>
                total +
                decimalToNumber(
                  payment.amount,
                ),
              0,
            );

          const unavailablePayoutAmount =
            existingPayouts.reduce(
              (
                total,
                payout,
              ) => {
                if (
                  payout.status ===
                    PayoutStatus.PENDING ||
                  payout.status ===
                    PayoutStatus.PROCESSING ||
                  payout.status ===
                    PayoutStatus.PAID
                ) {
                  return total +
                    decimalToNumber(
                      payout.amount,
                    );
                }

                return total;
              },
              0,
            );

          const availableBalanceBefore =
            normalizeMoney(
              Math.max(
                organizerNet -
                  refundedAmount -
                  unavailablePayoutAmount,
                0,
              ),
              currency,
            );

          if (
            amount >
            availableBalanceBefore
          ) {
            throw new RequestPayoutRouteError({
              code:
                "INSUFFICIENT_BALANCE",

              status:
                422,

              message:
                "Le montant demandé dépasse votre solde disponible.",

              details: {
                requestedAmount:
                  amount,

                availableBalance:
                  availableBalanceBefore,

                currency,
              },
            });
          }

          const fee =
            calculatePayoutFee({
              amount,

              fixedFee,

              percentageFee,

              currency,
            });

          const netAmount =
            normalizeMoney(
              amount - fee,
              currency,
            );

          if (
            netAmount <= 0
          ) {
            throw new RequestPayoutRouteError({
              code:
                "INVALID_NET_AMOUNT",

              status:
                422,

              message:
                "Le montant net du retrait doit être supérieur à zéro.",
            });
          }

          const reference =
            createPayoutReference();

          const destinationSnapshot =
            buildDestinationSnapshot(
              destination,
            );

          const payout =
            await transaction.payout.create({
              data: {
                organizerId:
                  organizer.id,

                destinationId:
                  destination.id,

                destinationType:
                  destination.type,

                destinationSnapshot,

                reference,

                amount:
                  new Prisma.Decimal(
                    amount,
                  ),

                fee:
                  new Prisma.Decimal(
                    fee,
                  ),

                netAmount:
                  new Prisma.Decimal(
                    netAmount,
                  ),

                currency,

                status:
                  PayoutStatus.PENDING,

                note,
              },

              select: {
                id:
                  true,

                reference:
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

                note:
                  true,

                destinationId:
                  true,

                destinationType:
                  true,

                destinationSnapshot:
                  true,

                requestedAt:
                  true,

                processedAt:
                  true,

                createdAt:
                  true,

                updatedAt:
                  true,
              },
            });

          await transaction.organizerActivity.create({
            data: {
              organizerId:
                organizer.id,

              type:
                OrganizerActivityType.PAYOUT_REQUESTED,

              title:
                "Demande de retrait créée",

              description:
                `Une demande de retrait de ${amount} ${currency} a été enregistrée.`,

              amount:
                new Prisma.Decimal(
                  amount,
                ),

              currency,

              metadata: {
                payoutId:
                  payout.id,

                reference:
                  payout.reference,

                fee,

                netAmount,

                destinationId:
                  destination.id,

                destinationType:
                  destination.type,

                destinationLabel:
                  buildDestinationLabel(
                    destination,
                  ),

                destinationReference:
                  buildDestinationReference(
                    destination,
                  ),

                requestedBy:
                  organizer.email,
              },
            },
          });

          return {
            payout,
            destination,

            availableBalanceBefore,

            availableBalanceAfter:
              normalizeMoney(
                Math.max(
                  availableBalanceBefore -
                    amount,
                  0,
                ),
                currency,
              ),
          };
        },
        {
          isolationLevel:
            Prisma
              .TransactionIsolationLevel
              .Serializable,
        },
      );
    } catch (error) {
      if (
        isRetryableTransactionError(
          error,
        ) &&
        attempt <
          MAX_TRANSACTION_RETRIES
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new RequestPayoutRouteError({
    code:
      "TRANSACTION_FAILED",

    status:
      503,

    message:
      "La demande de retrait n’a pas pu être enregistrée. Réessayez dans quelques instants.",
  });
}

async function sendPayoutNotifications({
  organizer,
  result,
  processingDelayHours,
}: {
  organizer:
    ConnectedOrganizer;

  result:
    TransactionResult;

  processingDelayHours:
    number;
}): Promise<{
  organizerEmailSent: boolean;
  adminEmailSent: boolean;
}> {
  const payoutReference =
    result.payout.reference;

  if (!payoutReference) {
    console.error(
      "[PAYOUT_NOTIFICATION_REFERENCE_MISSING]",
      {
        payoutId:
          result.payout.id,
      },
    );

    return {
      organizerEmailSent:
        false,

      adminEmailSent:
        false,
    };
  }

  try {
    const emailResult =
      await sendPayoutRequestedEmail({
        organizer: {
          firstName:
            organizer.firstName,

          lastName:
            organizer.lastName,

          businessName:
            organizer.businessName,

          email:
            organizer.email,

          phone:
            organizer.phone,
        },

        payout: {
          id:
            result.payout.id,

          reference:
            payoutReference,

          amount:
            decimalToNumber(
              result.payout.amount,
            ),

          fee:
            decimalToNumber(
              result.payout.fee,
            ),

          netAmount:
            decimalToNumber(
              result.payout.netAmount,
            ),

          currency:
            result.payout.currency,

          status:
            result.payout.status,

          requestedAt:
            result.payout.requestedAt,

          processingDelayHours,

          note:
            result.payout.note,
        },

        destination: {
          type:
            result.destination.type,

          label:
            buildDestinationLabel(
              result.destination,
            ),

          accountName:
            result.destination.accountName,

          country:
            result.destination.country,

          countryCode:
            result.destination.countryCode,

          reference:
            buildDestinationReference(
              result.destination,
            ),

          mobileProvider:
            getMobileProviderLabel(
              result.destination.mobileProvider,
            ),

          bankName:
            result.destination.bankName,

          cryptoNetwork:
            result.destination.cryptoNetwork,
        },

        organizerPaymentsUrl:
          "/organizer/payments",

        adminPaymentsUrl:
          `/admin/payments/payouts?reference=${encodeURIComponent(
            payoutReference,
          )}`,

        adminEmail:
          process.env
            .PAYOUT_ADMIN_EMAIL
            ?.trim() ||
          "support@tikemia.com",
      });

    return {
      organizerEmailSent:
        emailResult.organizerEmail.sent,

      adminEmailSent:
        emailResult.adminEmail.sent,
    };
  } catch (error) {
    console.error(
      "[PAYOUT_NOTIFICATION_SEND_ERROR]",
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

    return {
      organizerEmailSent:
        false,

      adminEmailSent:
        false,
    };
  }
}

export async function POST(
  request:
    NextRequest,
) {
  try {
    const organizer =
      await getConnectedOrganizer();

    const input =
      await readRequestBody(
        request,
      );

    const currency =
      normalizeCurrency(
        input.currency ||
        DEFAULT_CURRENCY_CODE,
      );

    const minimumAmount =
      normalizeMoney(
        readNonNegativeEnvironmentNumber({
          name:
            "PAYOUT_MINIMUM_AMOUNT",

          fallback:
            DEFAULT_MINIMUM_PAYOUT_AMOUNT,
        }),
        currency,
      );

    const fixedFee =
      normalizeMoney(
        readNonNegativeEnvironmentNumber({
          name:
            "PAYOUT_FIXED_FEE",

          fallback:
            DEFAULT_FIXED_PAYOUT_FEE,
        }),
        currency,
      );

    const percentageFee =
      Math.min(
        readNonNegativeEnvironmentNumber({
          name:
            "PAYOUT_PERCENTAGE_FEE",

          fallback:
            DEFAULT_PERCENTAGE_PAYOUT_FEE,
        }),
        100,
      );

    const processingDelayHours =
      readPositiveEnvironmentInteger({
        name:
          "PAYOUT_PROCESSING_DELAY_HOURS",

        fallback:
          DEFAULT_PROCESSING_DELAY_HOURS,
      });

    const amount =
      normalizeMoney(
        input.amount,
        currency,
      );

    if (
      amount <
      minimumAmount
    ) {
      throw new RequestPayoutRouteError({
        code:
          "AMOUNT_BELOW_MINIMUM",

        status:
          422,

        message:
          `Le montant minimum autorisé pour un retrait est de ${minimumAmount} ${currency}.`,

        details: {
          minimumAmount,
          currency,
        },
      });
    }

    const note =
      normalizeOptionalText(
        input.note,
      );

    const destinationId =
      normalizeText(
        input.destinationId,
      );

    const destinationType =
      input.destinationType;

    const result =
      await createPayoutInTransaction({
        organizer,

        amount,

        currency,

        note,

        destinationId,

        destinationType,

        fixedFee,

        percentageFee,
      });

    const notifications =
      await sendPayoutNotifications({
        organizer,

        result,

        processingDelayHours,
      });

    return NextResponse.json(
      {
        success:
          true,

        message:
          "Votre demande de retrait a été enregistrée avec succès. Un e-mail de confirmation vous sera envoyé.",

        payout:
          serializePayout(
            result.payout,
          ),

        destination: {
          id:
            result.destination.id,

          type:
            result.destination.type,

          label:
            buildDestinationLabel(
              result.destination,
            ),

          accountName:
            result.destination.accountName,

          reference:
            buildDestinationReference(
              result.destination,
            ),

          country:
            result.destination.country,

          countryCode:
            result.destination.countryCode,

          currency:
            result.destination.currency,
        },

        balance: {
          before:
            result.availableBalanceBefore,

          after:
            result.availableBalanceAfter,

          currency,
        },

        notifications,
      },
      {
        status:
          201,

        headers: {
          "Cache-Control":
            "no-store",

          "X-Content-Type-Options":
            "nosniff",
        },
      },
    );
  } catch (error) {
    if (
      error instanceof
      RequestPayoutRouteError
    ) {
      return createErrorResponse({
        code:
          error.code,

        message:
          error.message,

        status:
          error.status,

        details:
          error.details,
      });
    }

    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code ===
        "P2002"
    ) {
      return createErrorResponse({
        code:
          "PAYOUT_REFERENCE_CONFLICT",

        status:
          409,

        message:
          "Une collision de référence s’est produite. Veuillez réessayer.",
      });
    }

    console.error(
      "[ORGANIZER_PAYOUT_REQUEST_ERROR]",
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

    return createErrorResponse({
      code:
        "INTERNAL_ERROR",

      status:
        500,

      message:
        "Impossible d’enregistrer la demande de retrait pour le moment.",
    });
  }
}
