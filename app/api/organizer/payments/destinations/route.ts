import {
  createCipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import {
  MobileMoneyProvider,
  PayoutDestinationStatus,
  PayoutDestinationType,
  Prisma,
} from "@prisma/client";
import { cookies } from "next/headers";
import {
  NextRequest,
  NextResponse,
} from "next/server";
import { z } from "zod";

import {
  GetOrganizerPayoutDestinationsError,
  getOrganizerPayoutDestinations,
  type OrganizerMobileMoneyProvider,
  type OrganizerPayoutDestinationStatus,
  type OrganizerPayoutDestinationType,
} from "@/lib/organizer/get-organizer-payout-destinations";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SESSION_COOKIE_FALLBACK_NAME =
  "tikemia_session";

const ENCRYPTION_KEY_ENV_NAME =
  "PAYOUT_DESTINATION_ENCRYPTION_KEY";

const MOBILE_PHONE_MIN_LENGTH = 6;
const MOBILE_PHONE_MAX_LENGTH = 15;

const ACCOUNT_NAME_MAX_LENGTH = 160;
const BANK_NAME_MAX_LENGTH = 160;
const BANK_ACCOUNT_MAX_LENGTH = 64;
const IBAN_MAX_LENGTH = 34;
const SWIFT_BIC_MAX_LENGTH = 11;
const BANK_CODE_MAX_LENGTH = 32;
const BRANCH_CODE_MAX_LENGTH = 32;
const BANK_ADDRESS_MAX_LENGTH = 240;

const TRC20_NETWORK = "TRC20";
const TRON_ADDRESS_PATTERN =
  /^T[1-9A-HJ-NP-Za-km-z]{33}$/;

const COUNTRY_CODE_PATTERN =
  /^[A-Z]{2}$/;

const CURRENCY_PATTERN =
  /^[A-Z]{3,10}$/;

const DIAL_CODE_PATTERN =
  /^\+[1-9]\d{0,3}$/;

const mobileMoneySchema =
  z.object({
    type: z.literal(
      PayoutDestinationType.MOBILE_MONEY,
    ),

    country: z
      .string()
      .trim()
      .min(2)
      .max(100),

    countryCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(
        COUNTRY_CODE_PATTERN,
        "Le code pays doit contenir deux lettres.",
      ),

    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(
        CURRENCY_PATTERN,
        "La devise est invalide.",
      ),

    accountName: z
      .string()
      .trim()
      .min(2)
      .max(
        ACCOUNT_NAME_MAX_LENGTH,
      ),

    mobileProvider:
      z.nativeEnum(
        MobileMoneyProvider,
      ),

    phoneCountryCode:
      z.string()
        .trim()
        .regex(
          DIAL_CODE_PATTERN,
          "L’indicatif téléphonique est invalide.",
        ),

    phoneNumber:
      z.string()
        .trim()
        .min(
          MOBILE_PHONE_MIN_LENGTH,
        )
        .max(
          MOBILE_PHONE_MAX_LENGTH,
        ),

    isDefault:
      z.boolean()
        .optional()
        .default(false),
  })
  .strict();

const bankAccountSchema =
  z.object({
    type: z.literal(
      PayoutDestinationType.BANK_ACCOUNT,
    ),

    country: z
      .string()
      .trim()
      .min(2)
      .max(100),

    countryCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(
        COUNTRY_CODE_PATTERN,
        "Le code pays doit contenir deux lettres.",
      ),

    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(
        CURRENCY_PATTERN,
        "La devise est invalide.",
      ),

    accountName: z
      .string()
      .trim()
      .min(2)
      .max(
        ACCOUNT_NAME_MAX_LENGTH,
      ),

    bankName: z
      .string()
      .trim()
      .min(2)
      .max(
        BANK_NAME_MAX_LENGTH,
      ),

    bankAccountNumber:
      z.string()
        .trim()
        .min(4)
        .max(
          BANK_ACCOUNT_MAX_LENGTH,
        )
        .nullable()
        .optional(),

    iban: z
      .string()
      .trim()
      .max(
        IBAN_MAX_LENGTH,
      )
      .nullable()
      .optional(),

    swiftBic: z
      .string()
      .trim()
      .max(
        SWIFT_BIC_MAX_LENGTH,
      )
      .nullable()
      .optional(),

    bankCode: z
      .string()
      .trim()
      .max(
        BANK_CODE_MAX_LENGTH,
      )
      .nullable()
      .optional(),

    branchCode: z
      .string()
      .trim()
      .max(
        BRANCH_CODE_MAX_LENGTH,
      )
      .nullable()
      .optional(),

    bankAddress: z
      .string()
      .trim()
      .max(
        BANK_ADDRESS_MAX_LENGTH,
      )
      .nullable()
      .optional(),

    isDefault:
      z.boolean()
        .optional()
        .default(false),
  })
  .strict();

const cryptoUsdtSchema =
  z.object({
    type: z.literal(
      PayoutDestinationType.CRYPTO_USDT_TRC20,
    ),

    country: z
      .string()
      .trim()
      .min(2)
      .max(100),

    countryCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(
        COUNTRY_CODE_PATTERN,
        "Le code pays doit contenir deux lettres.",
      ),

    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(
        CURRENCY_PATTERN,
        "La devise est invalide.",
      ),

    accountName: z
      .string()
      .trim()
      .min(2)
      .max(
        ACCOUNT_NAME_MAX_LENGTH,
      ),

    cryptoNetwork:
      z.literal(
        TRC20_NETWORK,
      )
        .optional()
        .default(
          TRC20_NETWORK,
        ),

    cryptoAddress:
      z.string()
        .trim()
        .regex(
          TRON_ADDRESS_PATTERN,
          "L’adresse USDT TRC20 est invalide.",
        ),

    isDefault:
      z.boolean()
        .optional()
        .default(false),
  })
  .strict();

const createDestinationSchema =
  z.discriminatedUnion(
    "type",
    [
      mobileMoneySchema,
      bankAccountSchema,
      cryptoUsdtSchema,
    ],
  )
  .superRefine(
    (
      value,
      context,
    ) => {
      if (
        value.type !==
        PayoutDestinationType.BANK_ACCOUNT
      ) {
        return;
      }

      const accountNumber =
        normalizeSensitiveText(
          value.bankAccountNumber,
        );

      const iban =
        normalizeSensitiveText(
          value.iban,
        );

      if (
        !accountNumber &&
        !iban
      ) {
        context.addIssue({
          code:
            z.ZodIssueCode.custom,
          path: [
            "bankAccountNumber",
          ],
          message:
            "Renseignez un numéro de compte ou un IBAN.",
        });
      }
    },
  );

type CreateDestinationInput =
  z.infer<
    typeof createDestinationSchema
  >;

type ConnectedOrganizer = {
  id: string;
  email: string;
};

class PayoutDestinationsRouteError extends Error {
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
      "PayoutDestinationsRouteError";

    this.code = code;
    this.status = status;
    this.details = details;
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
      success: false,

      error: {
        code,
        message,

        ...(details === undefined
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

function normalizeSensitiveText(
  value:
    | string
    | null
    | undefined,
): string | null {
  const normalized =
    normalizeText(value)
      .replace(
        /\s+/g,
        "",
      );

  return normalized || null;
}

function normalizePhoneNumber(
  value: string,
): string {
  const normalized =
    value.replace(
      /\D/g,
      "",
    );

  if (
    normalized.length <
      MOBILE_PHONE_MIN_LENGTH ||
    normalized.length >
      MOBILE_PHONE_MAX_LENGTH
  ) {
    throw new PayoutDestinationsRouteError({
      code:
        "INVALID_PHONE_NUMBER",

      status:
        400,

      message:
        "Le numéro Mobile Money est invalide.",
    });
  }

  return normalized;
}

function normalizeIban(
  value:
    | string
    | null
    | undefined,
): string | null {
  const normalized =
    normalizeSensitiveText(
      value,
    )
      ?.toUpperCase() ??
    null;

  if (
    normalized &&
    (
      normalized.length <
        8 ||
      normalized.length >
        IBAN_MAX_LENGTH
    )
  ) {
    throw new PayoutDestinationsRouteError({
      code:
        "INVALID_IBAN",

      status:
        400,

      message:
        "L’IBAN est invalide.",
    });
  }

  return normalized;
}

function normalizeSwiftBic(
  value:
    | string
    | null
    | undefined,
): string | null {
  const normalized =
    normalizeSensitiveText(
      value,
    )
      ?.toUpperCase() ??
    null;

  if (
    normalized &&
    !/^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(
      normalized,
    )
  ) {
    throw new PayoutDestinationsRouteError({
      code:
        "INVALID_SWIFT_BIC",

      status:
        400,

      message:
        "Le code SWIFT/BIC est invalide.",
    });
  }

  return normalized;
}

function getLastCharacters(
  value:
    | string
    | null,
  length: number,
): string | null {
  if (!value) {
    return null;
  }

  return value.slice(
    -length,
  );
}

function getEncryptionKey(): Buffer {
  const secret =
    process.env[
      ENCRYPTION_KEY_ENV_NAME
    ]?.trim();

  if (
    !secret ||
    secret.length <
      32
  ) {
    throw new PayoutDestinationsRouteError({
      code:
        "PAYOUT_ENCRYPTION_NOT_CONFIGURED",

      status:
        500,

      message:
        "La protection des informations de retrait n’est pas configurée.",
    });
  }

  return createHash(
    "sha256",
  )
    .update(secret)
    .digest();
}

function encryptSensitiveValue(
  value: string,
): string {
  const key =
    getEncryptionKey();

  const iv =
    randomBytes(12);

  const cipher =
    createCipheriv(
      "aes-256-gcm",
      key,
      iv,
    );

  const encrypted =
    Buffer.concat([
      cipher.update(
        value,
        "utf8",
      ),

      cipher.final(),
    ]);

  const authenticationTag =
    cipher.getAuthTag();

  return [
    "v1",
    iv.toString(
      "base64url",
    ),
    authenticationTag.toString(
      "base64url",
    ),
    encrypted.toString(
      "base64url",
    ),
  ].join(".");
}

function parseBooleanSearchParam(
  value: string | null,
  fallback: boolean,
): boolean {
  if (value === null) {
    return fallback;
  }

  return (
    value === "1" ||
    value.toLowerCase() ===
      "true"
  );
}

function parseDestinationType(
  value: string | null,
): OrganizerPayoutDestinationType | null {
  if (
    value ===
      PayoutDestinationType.MOBILE_MONEY ||
    value ===
      PayoutDestinationType.BANK_ACCOUNT ||
    value ===
      PayoutDestinationType.CRYPTO_USDT_TRC20
  ) {
    return value;
  }

  return null;
}

function parseDestinationStatus(
  value: string | null,
): OrganizerPayoutDestinationStatus | null {
  if (
    value ===
      PayoutDestinationStatus.PENDING ||
    value ===
      PayoutDestinationStatus.VERIFIED ||
    value ===
      PayoutDestinationStatus.REJECTED ||
    value ===
      PayoutDestinationStatus.DISABLED
  ) {
    return value;
  }

  return null;
}

function parseMobileProvider(
  value: string | null,
): OrganizerMobileMoneyProvider | null {
  if (
    value ===
      MobileMoneyProvider.MTN_MOMO ||
    value ===
      MobileMoneyProvider.MOOV_MONEY ||
    value ===
      MobileMoneyProvider.ORANGE_MONEY ||
    value ===
      MobileMoneyProvider.WAVE
  ) {
    return value;
  }

  return null;
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
    throw new PayoutDestinationsRouteError({
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
        id: true,
        expiresAt: true,

        user: {
          select: {
            id: true,
            email: true,
            role: true,
            emailVerified: true,
            isActive: true,
          },
        },
      },
    });

  if (!session) {
    throw new PayoutDestinationsRouteError({
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
            "[PAYOUT_DESTINATIONS_EXPIRED_SESSION_DELETE_ERROR]",
            error instanceof Error
              ? error.message
              : error,
          );
        },
      );

    throw new PayoutDestinationsRouteError({
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
    throw new PayoutDestinationsRouteError({
      code:
        "FORBIDDEN",

      status:
        403,

      message:
        "Ce compte n’est pas autorisé à gérer les moyens de retrait.",
    });
  }

  return {
    id:
      organizer.id,

    email:
      organizer.email,
  };
}

async function readCreateDestinationBody(
  request: NextRequest,
): Promise<CreateDestinationInput> {
  let body: unknown;

  try {
    body =
      await request.json();
  } catch {
    throw new PayoutDestinationsRouteError({
      code:
        "INVALID_JSON",

      status:
        400,

      message:
        "Le contenu de la requête est invalide.",
    });
  }

  const parsed =
    createDestinationSchema.safeParse(
      body,
    );

  if (!parsed.success) {
    throw new PayoutDestinationsRouteError({
      code:
        "INVALID_DESTINATION",

      status:
        400,

      message:
        "Les informations du moyen de retrait sont invalides.",

      details:
        parsed.error.flatten(),
    });
  }

  return parsed.data;
}

function buildDestinationCreateData({
  organizerId,
  input,
  isDefault,
}: {
  organizerId: string;
  input: CreateDestinationInput;
  isDefault: boolean;
}): Prisma.PayoutDestinationCreateInput {
  const commonData = {
    organizer: {
      connect: {
        id:
          organizerId,
      },
    },

    type:
      input.type,

    status:
      PayoutDestinationStatus.PENDING,

    country:
      input.country.trim(),

    countryCode:
      input.countryCode
        .trim()
        .toUpperCase(),

    currency:
      input.currency
        .trim()
        .toUpperCase(),

    accountName:
      input.accountName.trim(),

    isDefault,
    isActive:
      true,
  } satisfies Pick<
    Prisma.PayoutDestinationCreateInput,
    | "organizer"
    | "type"
    | "status"
    | "country"
    | "countryCode"
    | "currency"
    | "accountName"
    | "isDefault"
    | "isActive"
  >;

  if (
    input.type ===
    PayoutDestinationType.MOBILE_MONEY
  ) {
    const phoneNumber =
      normalizePhoneNumber(
        input.phoneNumber,
      );

    return {
      ...commonData,

      mobileProvider:
        input.mobileProvider,

      phoneCountryCode:
        input.phoneCountryCode.trim(),

      phoneNumberEncrypted:
        encryptSensitiveValue(
          phoneNumber,
        ),

      phoneNumberLast4:
        getLastCharacters(
          phoneNumber,
          4,
        ),
    };
  }

  if (
    input.type ===
    PayoutDestinationType.BANK_ACCOUNT
  ) {
    const bankAccountNumber =
      normalizeSensitiveText(
        input.bankAccountNumber,
      );

    const iban =
      normalizeIban(
        input.iban,
      );

    const swiftBic =
      normalizeSwiftBic(
        input.swiftBic,
      );

    return {
      ...commonData,

      bankName:
        input.bankName.trim(),

      bankAccountNumberEncrypted:
        bankAccountNumber
          ? encryptSensitiveValue(
              bankAccountNumber,
            )
          : null,

      bankAccountNumberLast4:
        getLastCharacters(
          bankAccountNumber,
          4,
        ),

      ibanEncrypted:
        iban
          ? encryptSensitiveValue(
              iban,
            )
          : null,

      ibanLast4:
        getLastCharacters(
          iban,
          4,
        ),

      swiftBic,

      bankCode:
        normalizeOptionalText(
          input.bankCode,
        ),

      branchCode:
        normalizeOptionalText(
          input.branchCode,
        ),

      bankAddress:
        normalizeOptionalText(
          input.bankAddress,
        ),
    };
  }

  const cryptoAddress =
    input.cryptoAddress.trim();

  return {
    ...commonData,

    cryptoNetwork:
      TRC20_NETWORK,

    cryptoAddressEncrypted:
      encryptSensitiveValue(
        cryptoAddress,
      ),

    cryptoAddressLast6:
      getLastCharacters(
        cryptoAddress,
        6,
      ),
  };
}

async function createDestination({
  organizer,
  input,
}: {
  organizer: ConnectedOrganizer;
  input: CreateDestinationInput;
}) {
  return prisma.$transaction(
    async (
      transaction,
    ) => {
      const destinationCount =
        await transaction.payoutDestination.count({
          where: {
            organizerId:
              organizer.id,

            isActive:
              true,
          },
        });

      const shouldBeDefault =
        input.isDefault ||
        destinationCount ===
          0;

      if (
        shouldBeDefault
      ) {
        await transaction.payoutDestination.updateMany({
          where: {
            organizerId:
              organizer.id,

            isDefault:
              true,
          },

          data: {
            isDefault:
              false,
          },
        });
      }

      const destination =
        await transaction.payoutDestination.create({
          data:
            buildDestinationCreateData({
              organizerId:
                organizer.id,

              input,

              isDefault:
                shouldBeDefault,
            }),

          select: {
            id: true,
            type: true,
            status: true,
            country: true,
            countryCode: true,
            currency: true,
            accountName: true,
            mobileProvider: true,
            phoneCountryCode: true,
            phoneNumberLast4: true,
            bankName: true,
            bankAccountNumberLast4: true,
            ibanLast4: true,
            swiftBic: true,
            bankCode: true,
            branchCode: true,
            bankAddress: true,
            cryptoNetwork: true,
            cryptoAddressLast6: true,
            isDefault: true,
            isActive: true,
            verifiedAt: true,
            rejectedAt: true,
            rejectionReason: true,
            createdAt: true,
            updatedAt: true,
          },
        });

      return destination;
    },
    {
      isolationLevel:
        Prisma.TransactionIsolationLevel.Serializable,
    },
  );
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

function serializeCreatedDestination(
  destination:
    Awaited<
      ReturnType<
        typeof createDestination
      >
    >,
) {
  const bankReference =
    destination.ibanLast4 ??
    destination.bankAccountNumberLast4;

  return {
    id:
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

    mobileProvider:
      destination.mobileProvider,

    phoneCountryCode:
      destination.phoneCountryCode,

    maskedPhoneNumber:
      buildMaskedPhoneNumber({
        phoneCountryCode:
          destination.phoneCountryCode,

        phoneNumberLast4:
          destination.phoneNumberLast4,
      }),

    bankName:
      destination.bankName,

    maskedBankAccountNumber:
      destination.bankAccountNumberLast4
        ? `•••• •••• ${destination.bankAccountNumberLast4}`
        : null,

    maskedIban:
      destination.ibanLast4
        ? `•••• •••• ${destination.ibanLast4}`
        : null,

    swiftBic:
      destination.swiftBic,

    bankCode:
      destination.bankCode,

    branchCode:
      destination.branchCode,

    bankAddress:
      destination.bankAddress,

    cryptoNetwork:
      destination.cryptoNetwork,

    maskedCryptoAddress:
      destination.cryptoAddressLast6
        ? `TRC20 ••••••${destination.cryptoAddressLast6}`
        : null,

    destinationReference:
      destination.type ===
      PayoutDestinationType.MOBILE_MONEY
        ? buildMaskedPhoneNumber({
            phoneCountryCode:
              destination.phoneCountryCode,

            phoneNumberLast4:
              destination.phoneNumberLast4,
          })
        : destination.type ===
            PayoutDestinationType.BANK_ACCOUNT
          ? (
              bankReference
                ? `•••• •••• ${bankReference}`
                : "Compte masqué"
            )
          : (
              destination.cryptoAddressLast6
                ? `TRC20 ••••••${destination.cryptoAddressLast6}`
                : "Adresse masquée"
            ),

    isDefault:
      destination.isDefault,

    isActive:
      destination.isActive,

    isVerified:
      destination.status ===
      PayoutDestinationStatus.VERIFIED,

    canBeUsed:
      destination.isActive &&
      destination.status ===
        PayoutDestinationStatus.VERIFIED,

    verifiedAt:
      destination.verifiedAt?.toISOString() ??
      null,

    rejectedAt:
      destination.rejectedAt?.toISOString() ??
      null,

    rejectionReason:
      destination.rejectionReason,

    createdAt:
      destination.createdAt.toISOString(),

    updatedAt:
      destination.updatedAt.toISOString(),
  };
}

export async function GET(
  request: NextRequest,
) {
  try {
    const organizer =
      await getConnectedOrganizer();

    const searchParams =
      request.nextUrl.searchParams;

    const data =
      await getOrganizerPayoutDestinations({
        organizerId:
          organizer.id,

        includeInactive:
          parseBooleanSearchParam(
            searchParams.get(
              "includeInactive",
            ),
            false,
          ),

        includeRejected:
          parseBooleanSearchParam(
            searchParams.get(
              "includeRejected",
            ),
            false,
          ),

        type:
          parseDestinationType(
            searchParams.get(
              "type",
            ),
          ),

        status:
          parseDestinationStatus(
            searchParams.get(
              "status",
            ),
          ),

        countryCode:
          normalizeOptionalText(
            searchParams.get(
              "countryCode",
            ),
          ),

        currency:
          normalizeOptionalText(
            searchParams.get(
              "currency",
            ),
          ),

        mobileProvider:
          parseMobileProvider(
            searchParams.get(
              "mobileProvider",
            ),
          ),

        search:
          normalizeOptionalText(
            searchParams.get(
              "search",
            ),
          ),
      });

    return NextResponse.json(
      {
        success: true,
        ...data,
      },
      {
        status: 200,

        headers: {
          "Cache-Control":
            "no-store",

          "X-Content-Type-Options":
            "nosniff",
        },
      },
    );
  } catch (error) {
    return handleRouteError(
      error,
      "Impossible de charger les moyens de retrait pour le moment.",
    );
  }
}

export async function POST(
  request: NextRequest,
) {
  try {
    const organizer =
      await getConnectedOrganizer();

    const input =
      await readCreateDestinationBody(
        request,
      );

    const destination =
      await createDestination({
        organizer,
        input,
      });

    return NextResponse.json(
      {
        success: true,

        message:
          "Le moyen de retrait a été enregistré. Il pourra être utilisé après vérification.",

        destination:
          serializeCreatedDestination(
            destination,
          ),
      },
      {
        status: 201,

        headers: {
          "Cache-Control":
            "no-store",

          "X-Content-Type-Options":
            "nosniff",
        },
      },
    );
  } catch (error) {
    return handleRouteError(
      error,
      "Impossible d’enregistrer le moyen de retrait pour le moment.",
    );
  }
}

function handleRouteError(
  error: unknown,
  fallbackMessage: string,
) {
  if (
    error instanceof
    PayoutDestinationsRouteError
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
    GetOrganizerPayoutDestinationsError
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
      "P2034"
  ) {
    return createErrorResponse({
      code:
        "PAYOUT_DESTINATION_CONFLICT",

      status:
        409,

      message:
        "Une autre modification du moyen de retrait est en cours. Veuillez réessayer.",
    });
  }

  console.error(
    "[ORGANIZER_PAYOUT_DESTINATIONS_ROUTE_ERROR]",
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
      fallbackMessage,
  });
}