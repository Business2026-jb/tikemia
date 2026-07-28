import {
  MobileMoneyProvider,
  PayoutDestinationStatus,
  PayoutDestinationType,
  Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type OrganizerPayoutDestinationType =
  PayoutDestinationType;

export type OrganizerPayoutDestinationStatus =
  PayoutDestinationStatus;

export type OrganizerMobileMoneyProvider =
  MobileMoneyProvider;

export type OrganizerPayoutDestinationOption = {
  id: string;
  type: OrganizerPayoutDestinationType;
  status: OrganizerPayoutDestinationStatus;
  country: string;
  countryCode: string;
  currency: string;
  accountName: string;
  mobileProvider: OrganizerMobileMoneyProvider | null;
  phoneCountryCode: string | null;
  maskedPhoneNumber: string | null;
  bankName: string | null;
  maskedBankAccountNumber: string | null;
  maskedIban: string | null;
  swiftBic: string | null;
  bankCode: string | null;
  branchCode: string | null;
  bankAddress: string | null;
  cryptoNetwork: string | null;
  maskedCryptoAddress: string | null;
  isDefault: boolean;
  isActive: boolean;
  isVerified: boolean;
  canBeUsed: boolean;
  label: string;
  subtitle: string;
  destinationReference: string;
  verifiedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrganizerPayoutDestinationFilters = {
  types: Array<{
    value: OrganizerPayoutDestinationType;
    label: string;
    count: number;
  }>;
  statuses: Array<{
    value: OrganizerPayoutDestinationStatus;
    label: string;
    count: number;
  }>;
  countries: Array<{
    value: string;
    label: string;
    count: number;
  }>;
  currencies: Array<{
    value: string;
    label: string;
    count: number;
  }>;
  mobileProviders: Array<{
    value: OrganizerMobileMoneyProvider;
    label: string;
    count: number;
  }>;
};

export type OrganizerPayoutDestinationsData = {
  destinations: OrganizerPayoutDestinationOption[];
  defaultDestination: OrganizerPayoutDestinationOption | null;
  summary: {
    total: number;
    active: number;
    verified: number;
    pending: number;
    rejected: number;
    disabled: number;
    mobileMoney: number;
    bankAccounts: number;
    cryptoUsdtTrc20: number;
  };
  filters: OrganizerPayoutDestinationFilters;
  generatedAt: string;
};

export type GetOrganizerPayoutDestinationsParams = {
  organizerId: string;
  includeInactive?: boolean;
  includeRejected?: boolean;
  type?: OrganizerPayoutDestinationType | null;
  status?: OrganizerPayoutDestinationStatus | null;
  countryCode?: string | null;
  currency?: string | null;
  mobileProvider?: OrganizerMobileMoneyProvider | null;
  search?: string | null;
};

export class GetOrganizerPayoutDestinationsError extends Error {
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
    this.name = "GetOrganizerPayoutDestinationsError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const TYPE_LABELS: Record<OrganizerPayoutDestinationType, string> = {
  MOBILE_MONEY: "Mobile Money",
  BANK_ACCOUNT: "Virement bancaire",
  CRYPTO_USDT_TRC20: "USDT TRC20",
};

const STATUS_LABELS: Record<OrganizerPayoutDestinationStatus, string> = {
  PENDING: "En attente",
  VERIFIED: "Vérifié",
  REJECTED: "Rejeté",
  DISABLED: "Désactivé",
};

const MOBILE_PROVIDER_LABELS: Record<
  OrganizerMobileMoneyProvider,
  string
> = {
  MTN_MOMO:
    "MTN Mobile Money",

  MOOV_MONEY:
    "Moov Money",

  CELTIIS_CASH:
    "Celtiis Cash",

  ORANGE_MONEY:
    "Orange Money",

  WAVE:
    "Wave",

  FREE_MONEY:
    "Free Money",

  AIRTEL_MONEY:
    "Airtel Money",

  MIXX_BY_YAS:
    "Mixx by Yas",
};

const PAYOUT_DESTINATION_SELECT =
  Prisma.validator<Prisma.PayoutDestinationSelect>()({
    id: true,
    organizerId: true,
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
  });

type PayoutDestinationRecord = Prisma.PayoutDestinationGetPayload<{
  select: typeof PAYOUT_DESTINATION_SELECT;
}>;

function normalizeText(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function normalizeOrganizerId(value: string): string {
  const normalized = normalizeText(value);

  if (!normalized) {
    throw new GetOrganizerPayoutDestinationsError({
      code: "ORGANIZER_ID_REQUIRED",
      status: 400,
      message: "L’identifiant de l’organisateur est obligatoire.",
    });
  }

  return normalized;
}

function maskLastDigits({
  lastDigits,
  prefix = "••••",
}: {
  lastDigits: string | null | undefined;
  prefix?: string;
}): string | null {
  const normalized = normalizeText(lastDigits);
  return normalized ? `${prefix}${normalized}` : null;
}

function buildMaskedPhoneNumber(
  phoneCountryCode: string | null,
  phoneNumberLast4: string | null,
): string | null {
  const dialCode = normalizeText(phoneCountryCode);
  const masked = maskLastDigits({ lastDigits: phoneNumberLast4 });

  if (!masked) {
    return null;
  }

  return dialCode ? `${dialCode} ${masked}` : masked;
}

function buildMaskedBankReference(last4: string | null): string | null {
  return maskLastDigits({
    lastDigits: last4,
    prefix: "•••• •••• ",
  });
}

function buildMaskedCryptoReference(last6: string | null): string | null {
  return maskLastDigits({
    lastDigits: last6,
    prefix: "TRC20 ••••••",
  });
}

function getProviderLabel(provider: MobileMoneyProvider | null): string {
  return provider ? MOBILE_PROVIDER_LABELS[provider] : "Mobile Money";
}

function buildDestinationReference(
  destination: PayoutDestinationRecord,
): string {
  if (destination.type === PayoutDestinationType.MOBILE_MONEY) {
    return (
      buildMaskedPhoneNumber(
        destination.phoneCountryCode,
        destination.phoneNumberLast4,
      ) ?? "Numéro masqué"
    );
  }

  if (destination.type === PayoutDestinationType.BANK_ACCOUNT) {
    return (
      buildMaskedBankReference(
        destination.ibanLast4 ?? destination.bankAccountNumberLast4,
      ) ?? "Compte masqué"
    );
  }

  return (
    buildMaskedCryptoReference(destination.cryptoAddressLast6) ??
    "Adresse masquée"
  );
}

function buildDestinationLabel(destination: PayoutDestinationRecord): string {
  if (destination.type === PayoutDestinationType.MOBILE_MONEY) {
    return getProviderLabel(destination.mobileProvider);
  }

  if (destination.type === PayoutDestinationType.BANK_ACCOUNT) {
    return normalizeText(destination.bankName) || "Compte bancaire";
  }

  return "USDT TRC20";
}

function buildDestinationSubtitle(
  destination: PayoutDestinationRecord,
): string {
  return [
    destination.accountName,
    destination.country,
    buildDestinationReference(destination),
  ]
    .map(normalizeText)
    .filter(Boolean)
    .join(" • ");
}

function serializeDestination(
  destination: PayoutDestinationRecord,
): OrganizerPayoutDestinationOption {
  const isVerified =
    destination.status === PayoutDestinationStatus.VERIFIED;

  return {
    id: destination.id,
    type: destination.type,
    status: destination.status,
    country: destination.country,
    countryCode: destination.countryCode,
    currency: destination.currency,
    accountName: destination.accountName,
    mobileProvider: destination.mobileProvider,
    phoneCountryCode: destination.phoneCountryCode,
    maskedPhoneNumber: buildMaskedPhoneNumber(
      destination.phoneCountryCode,
      destination.phoneNumberLast4,
    ),
    bankName: destination.bankName,
    maskedBankAccountNumber: buildMaskedBankReference(
      destination.bankAccountNumberLast4,
    ),
    maskedIban: buildMaskedBankReference(destination.ibanLast4),
    swiftBic: destination.swiftBic,
    bankCode: destination.bankCode,
    branchCode: destination.branchCode,
    bankAddress: destination.bankAddress,
    cryptoNetwork: destination.cryptoNetwork,
    maskedCryptoAddress: buildMaskedCryptoReference(
      destination.cryptoAddressLast6,
    ),
    isDefault: destination.isDefault,
    isActive: destination.isActive,
    isVerified,
    canBeUsed: destination.isActive && isVerified,
    label: buildDestinationLabel(destination),
    subtitle: buildDestinationSubtitle(destination),
    destinationReference: buildDestinationReference(destination),
    verifiedAt: destination.verifiedAt?.toISOString() ?? null,
    rejectedAt: destination.rejectedAt?.toISOString() ?? null,
    rejectionReason: destination.rejectionReason,
    createdAt: destination.createdAt.toISOString(),
    updatedAt: destination.updatedAt.toISOString(),
  };
}

function createEmptySummary() {
  return {
    total: 0,
    active: 0,
    verified: 0,
    pending: 0,
    rejected: 0,
    disabled: 0,
    mobileMoney: 0,
    bankAccounts: 0,
    cryptoUsdtTrc20: 0,
  };
}

function buildSummary(destinations: PayoutDestinationRecord[]) {
  return destinations.reduce((summary, destination) => {
    summary.total += 1;

    if (destination.isActive) summary.active += 1;
    if (destination.status === PayoutDestinationStatus.VERIFIED) {
      summary.verified += 1;
    }
    if (destination.status === PayoutDestinationStatus.PENDING) {
      summary.pending += 1;
    }
    if (destination.status === PayoutDestinationStatus.REJECTED) {
      summary.rejected += 1;
    }
    if (destination.status === PayoutDestinationStatus.DISABLED) {
      summary.disabled += 1;
    }
    if (destination.type === PayoutDestinationType.MOBILE_MONEY) {
      summary.mobileMoney += 1;
    }
    if (destination.type === PayoutDestinationType.BANK_ACCOUNT) {
      summary.bankAccounts += 1;
    }
    if (destination.type === PayoutDestinationType.CRYPTO_USDT_TRC20) {
      summary.cryptoUsdtTrc20 += 1;
    }

    return summary;
  }, createEmptySummary());
}

function incrementCount<TKey extends string>(
  map: Map<TKey, number>,
  key: TKey,
) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function buildFilters(
  destinations: PayoutDestinationRecord[],
): OrganizerPayoutDestinationFilters {
  const typeCounts = new Map<OrganizerPayoutDestinationType, number>();
  const statusCounts = new Map<OrganizerPayoutDestinationStatus, number>();
  const countryCounts = new Map<string, { label: string; count: number }>();
  const currencyCounts = new Map<string, number>();
  const providerCounts = new Map<OrganizerMobileMoneyProvider, number>();

  destinations.forEach((destination) => {
    incrementCount(typeCounts, destination.type);
    incrementCount(statusCounts, destination.status);

    const countryCode = normalizeText(destination.countryCode).toUpperCase();
    if (countryCode) {
      const current = countryCounts.get(countryCode);
      countryCounts.set(countryCode, {
        label: normalizeText(destination.country) || countryCode,
        count: (current?.count ?? 0) + 1,
      });
    }

    const currency = normalizeText(destination.currency).toUpperCase();
    if (currency) incrementCount(currencyCounts, currency);

    if (destination.mobileProvider) {
      incrementCount(providerCounts, destination.mobileProvider);
    }
  });

  return {
    types: Array.from(typeCounts.entries()).map(([value, count]) => ({
      value,
      label: TYPE_LABELS[value],
      count,
    })),
    statuses: Array.from(statusCounts.entries()).map(([value, count]) => ({
      value,
      label: STATUS_LABELS[value],
      count,
    })),
    countries: Array.from(countryCounts.entries())
      .map(([value, item]) => ({ value, label: item.label, count: item.count }))
      .sort((a, b) => a.label.localeCompare(b.label, "fr")),
    currencies: Array.from(currencyCounts.entries())
      .map(([value, count]) => ({ value, label: value, count }))
      .sort((a, b) => a.value.localeCompare(b.value)),
    mobileProviders: Array.from(providerCounts.entries())
      .map(([value, count]) => ({
        value,
        label: MOBILE_PROVIDER_LABELS[value],
        count,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "fr")),
  };
}

function buildWhereClause({
  organizerId,
  includeInactive,
  includeRejected,
  type,
  status,
  countryCode,
  currency,
  mobileProvider,
  search,
}: Required<Pick<GetOrganizerPayoutDestinationsParams, "organizerId">> &
  Omit<GetOrganizerPayoutDestinationsParams, "organizerId">): Prisma.PayoutDestinationWhereInput {
  const where: Prisma.PayoutDestinationWhereInput = { organizerId };

  if (!includeInactive) where.isActive = true;
  if (!includeRejected && !status) {
    where.status = { not: PayoutDestinationStatus.REJECTED };
  }
  if (type) where.type = type;
  if (status) where.status = status;

  const normalizedCountryCode = normalizeText(countryCode).toUpperCase();
  if (normalizedCountryCode) where.countryCode = normalizedCountryCode;

  const normalizedCurrency = normalizeText(currency).toUpperCase();
  if (normalizedCurrency) where.currency = normalizedCurrency;

  if (mobileProvider) where.mobileProvider = mobileProvider;

  const normalizedSearch = normalizeText(search);
  if (normalizedSearch) {
    where.OR = [
      { accountName: { contains: normalizedSearch, mode: "insensitive" } },
      { country: { contains: normalizedSearch, mode: "insensitive" } },
      { countryCode: { contains: normalizedSearch, mode: "insensitive" } },
      { currency: { contains: normalizedSearch, mode: "insensitive" } },
      { bankName: { contains: normalizedSearch, mode: "insensitive" } },
      { swiftBic: { contains: normalizedSearch, mode: "insensitive" } },
      { phoneNumberLast4: { contains: normalizedSearch } },
      { bankAccountNumberLast4: { contains: normalizedSearch } },
      { ibanLast4: { contains: normalizedSearch } },
      { cryptoAddressLast6: { contains: normalizedSearch } },
    ];
  }

  return where;
}

export async function getOrganizerPayoutDestinations(
  params: GetOrganizerPayoutDestinationsParams,
): Promise<OrganizerPayoutDestinationsData> {
  const organizerId = normalizeOrganizerId(params.organizerId);

  try {
    const organizerExists = await prisma.user.count({
      where: {
        id: organizerId,
        role: "ORGANIZER",
        isActive: true,
      },
    });

    if (organizerExists === 0) {
      throw new GetOrganizerPayoutDestinationsError({
        code: "ORGANIZER_NOT_FOUND",
        status: 404,
        message: "L’organisateur est introuvable ou inactif.",
      });
    }

    const records = await prisma.payoutDestination.findMany({
      where: buildWhereClause({
        organizerId,
        includeInactive: params.includeInactive ?? false,
        includeRejected: params.includeRejected ?? false,
        type: params.type ?? null,
        status: params.status ?? null,
        countryCode: params.countryCode ?? null,
        currency: params.currency ?? null,
        mobileProvider: params.mobileProvider ?? null,
        search: params.search ?? null,
      }),
      select: PAYOUT_DESTINATION_SELECT,
      orderBy: [
        { isDefault: "desc" },
        { isActive: "desc" },
        { status: "asc" },
        { updatedAt: "desc" },
      ],
    });

    const destinations = records.map(serializeDestination);
    const defaultDestination =
      destinations.find((item) => item.isDefault && item.canBeUsed) ??
      destinations.find((item) => item.canBeUsed) ??
      null;

    return {
      destinations,
      defaultDestination,
      summary: buildSummary(records),
      filters: buildFilters(records),
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof GetOrganizerPayoutDestinationsError) {
      throw error;
    }

    console.error(
      "[GET_ORGANIZER_PAYOUT_DESTINATIONS_ERROR]",
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack:
              process.env.NODE_ENV === "development"
                ? error.stack
                : undefined,
          }
        : error,
    );

    throw new GetOrganizerPayoutDestinationsError({
      code: "PAYOUT_DESTINATIONS_LOAD_FAILED",
      status: 500,
      message: "Impossible de charger les moyens de retrait pour le moment.",
      details: process.env.NODE_ENV === "development" ? error : undefined,
    });
  }
}