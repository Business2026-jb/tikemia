
"use client";
import {
  currencySymbol,
  SUPPORTED_CURRENCIES,
  currencyLabel,
} from "@/i18n/config";




import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import Link from "next/link";
import Image from "next/image";

import {
  ArrowDownToLine,
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Coins,
  CreditCard,
  Info,
  Landmark,
  LoaderCircle,
  Mail,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Smartphone,
  Ticket,
  Wallet,
  X,
} from "lucide-react";

/* ==========================================================
   TIKEMIA — RETRAITS ORGANISATEUR

   Page :
   /organizer/dashboard/withdrawals

   API :
   GET /api/organizer/settings/profile

   GET /api/organizer/settings/withdrawal-methods

   POST /api/organizer/withdrawals/verify
     - action: send
     - action: confirm

   GET /api/organizer/withdrawals

   POST /api/organizer/withdrawals

   Fonctionnalités :
   - Soldes financiers réels
   - Frais globaux de 5 % fournis par l'API
   - Moyens enregistrés
   - Logos de paiement
   - Vérification OTP email
   - Validation des coordonnées
   - Demande de retrait
   - Historique avec statuts
   - Pagination
   - Langues FR / EN
   - PC et mobile pleine largeur

   Le layout dashboard existant fournit
   déjà les menus principaux.

   Aucun paiement n'est effectué côté client.
========================================================== */

const API = {
  profile: "/api/organizer/settings/profile",
  methods: "/api/organizer/settings/withdrawal-methods",
  withdrawals: "/api/organizer/withdrawals",
  verification: "/api/organizer/withdrawals/verify",
} as const;

const SETTINGS_URL = "/organizer/dashboard/settings";

const PAGE_SIZE = 10;
const REFRESH_INTERVAL_MS = 10_000;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUS_GROUPS = {
  pending: [
    "REQUESTED",
    "UNDER_REVIEW",
    "APPROVED",
    "PROCESSING",
  ],
  completed: ["COMPLETED"],
  rejected: ["REJECTED", "FAILED", "CANCELLED"],
} as const;

type Locale = "fr" | "en";

type PaymentMethodType =
  | "MOBILE_MONEY"
  | "BANK_ACCOUNT"
  | "CRYPTO";

type HistoryFilter =
  | "all"
  | "pending"
  | "completed"
  | "rejected";

type JsonRecord = Record<string, unknown>;

type Notice = {
  kind: "success" | "error" | "info";
  message: string;
};

type Organization = {
  id: string;
  name: string;
};

type WithdrawalMethod = {
  id: string;
  organizationId: string;
  type: PaymentMethodType;
  provider: string;
  accountName: string;
  maskedAccountRef: string;
  label: string;
  bankName: string;
  assetCode: string;
  networkCode: string;
  currency: string;
  countryCode: string;
  isVerified: boolean;
  isDefault: boolean;
};

type Balance = {
  gross: string;
  commission: string;
  net: string;
  available: string;
  pending: string;
  completed: string;
  currency: string;
};

type Withdrawal = {
  id: string;
  reference: string;
  destinationId: string;
  amountMinor: string;
  currency: string;
  status: string;
  requestedAt: string;
  completedAt: string | null;
  destination: {
    type: string;
    provider: string;
    maskedAccountRef: string;
    accountName: string;
    bankName: string;
    assetCode: string;
    networkCode: string;
  };
};

type Pagination = {
  page: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
};

type WithdrawalsResponse = {
  balance: Balance;
  history: Withdrawal[];
  pagination: Pagination;
};

type VerificationStep = "closed" | "send" | "confirm";

/* ==========================================================
   TRADUCTIONS
========================================================== */

const TEXT = {
  fr: {
    pageTitle: "Retraits",
    subtitle:
      "Consultez votre solde et demandez le retrait de vos gains.",

    gross: "Total brut encaissé",
    commission: "Commission TIKEMIA (5 %)",
    net: "Montant net",
    available: "Solde disponible",

    moneyInfo:
      "Les frais de 5 % sont déjà déduits. Aucun prélèvement supplémentaire n'est appliqué lors de votre demande de retrait.",

    withdrawalMethods: "Mes moyens de retrait",
    methodSubtitle:
      "Sélectionnez le compte sur lequel vous souhaitez recevoir vos fonds.",

    addMethod: "Ajouter un moyen",
    manageMethods: "Gérer mes moyens",

    verified: "Validé",
    unverified: "Non validé",
    default: "Par défaut",
    selected: "Sélectionné",
    select: "Sélectionner",
    validate: "Valider",
    noMethods: "Vous n'avez pas encore ajouté de moyen de retrait.",

    mobileMoney: "Mobile Money",
    bank: "Compte bancaire",
    crypto: "Cryptomonnaie",

    verificationTitle: "Valider le moyen de retrait",
    verificationExplanation:
      "Pour sécuriser vos retraits, un code de vérification sera envoyé à l'adresse email de votre compte TIKEMIA.",

    sendCode: "Envoyer le code",
    sendingCode: "Envoi du code...",
    codeSent: "Un code à 6 chiffres a été envoyé à votre email.",
    enterCode: "Code de vérification à 6 chiffres",
    confirmDetails:
      "Je confirme que les informations de ce moyen de retrait sont exactes.",

    verifyMethod: "Confirmer le moyen de retrait",
    verifying: "Vérification...",
    validatedMessage:
      "Votre moyen de retrait a été validé avec succès.",
    resendCode: "Renvoyer le code",
    resendIn: "Renvoyer dans",
    codeExpiration: "Le code expire au bout de 10 minutes.",
    emailDestination: "Email de vérification",
    codeRequired: "Veuillez saisir les 6 chiffres du code.",
    checkboxRequired:
      "Vous devez confirmer l'exactitude de vos coordonnées.",

    requestTitle: "Demander un retrait",
    requestSubtitle:
      "Choisissez un moyen validé et indiquez le montant souhaité.",

    withdrawalMethod: "Moyen de retrait",
    amount: "Montant à retirer",
    maximum: "Montant maximum",
    useMaximum: "Tout retirer",
    availableToWithdraw: "Disponible pour ce retrait",

    requestWithdrawal: "Confirmer mon retrait",
    requesting: "Enregistrement...",
    chooseMethod: "Veuillez sélectionner un moyen de retrait.",
    verifyFirst:
      "Votre moyen de retrait n'est pas encore validé. Veuillez d'abord le valider.",

    invalidAmount: "Veuillez saisir un montant valide.",
    insufficient:
      "Le montant demandé dépasse votre solde disponible.",

    requestSuccess:
      "Votre demande de retrait a été enregistrée. Elle sera examinée par l'administration TIKEMIA.",

    pendingAmount: "Retraits en cours",
    completedAmount: "Retraits effectués",

    historyTitle: "Historique des retraits",
    historySubtitle:
      "Retrouvez vos demandes et leur état de traitement.",

    all: "Tous",
    pending: "En cours",
    completed: "Validés",
    rejected: "Rejetés",

    reference: "Référence",
    date: "Date",
    account: "Moyen",
    status: "Statut",
    amountColumn: "Montant",

    requested: "Demandé",
    underReview: "En vérification",
    approved: "Approuvé",
    processing: "En traitement",
    finished: "Effectué",
    failed: "Échoué",
    refused: "Rejeté",
    cancelled: "Annulé",

    noHistory: "Aucun retrait à afficher.",
    refresh: "Actualiser",
    loading: "Chargement de vos retraits...",
    loadError: "Impossible de charger les informations de retrait.",
    retry: "Réessayer",
    close: "Fermer",
    cancel: "Annuler",
    page: "Page",
    of: "sur",
    organization: "Organisation",
    currency: "Devise",

    secure:
      "Votre demande sera examinée par l'administration. Aucun transfert n'est exécuté immédiatement.",

    notProvided: "Non renseigné",
    multiCurrency:
      "Les soldes sont affichés séparément pour chaque devise.",
    noBalance: "Aucun solde disponible dans cette devise.",
  },

  en: {
    pageTitle: "Withdrawals",
    subtitle:
      "View your balance and request a payout of your earnings.",

    gross: "Gross amount collected",
    commission: "TIKEMIA commission (5%)",
    net: "Net amount",
    available: "Available balance",

    moneyInfo:
      "The 5% platform commission has already been deducted. No additional commission is charged when requesting a withdrawal.",

    withdrawalMethods: "My withdrawal methods",
    methodSubtitle:
      "Select the account where you want to receive your funds.",

    addMethod: "Add a method",
    manageMethods: "Manage methods",

    verified: "Verified",
    unverified: "Not verified",
    default: "Default",
    selected: "Selected",
    select: "Select",
    validate: "Verify",
    noMethods: "You have not added any withdrawal method yet.",

    mobileMoney: "Mobile Money",
    bank: "Bank account",
    crypto: "Cryptocurrency",

    verificationTitle: "Verify withdrawal method",
    verificationExplanation:
      "To secure your withdrawals, a verification code will be sent to your TIKEMIA account email address.",

    sendCode: "Send code",
    sendingCode: "Sending code...",
    codeSent: "A 6-digit code has been sent to your email.",
    enterCode: "6-digit verification code",
    confirmDetails:
      "I confirm that this withdrawal method's details are correct.",

    verifyMethod: "Confirm withdrawal method",
    verifying: "Verifying...",
    validatedMessage:
      "Your withdrawal method was verified successfully.",
    resendCode: "Resend code",
    resendIn: "Resend in",
    codeExpiration: "The code expires after 10 minutes.",
    emailDestination: "Verification email",
    codeRequired: "Please enter the 6-digit code.",
    checkboxRequired:
      "Please confirm that your account details are correct.",

    requestTitle: "Request a withdrawal",
    requestSubtitle:
      "Choose a verified method and enter the amount.",

    withdrawalMethod: "Withdrawal method",
    amount: "Withdrawal amount",
    maximum: "Maximum amount",
    useMaximum: "Withdraw all",
    availableToWithdraw: "Available for withdrawal",

    requestWithdrawal: "Confirm my withdrawal",
    requesting: "Submitting...",
    chooseMethod: "Please select a withdrawal method.",
    verifyFirst:
      "This withdrawal method is not verified yet. Please verify it first.",

    invalidAmount: "Please enter a valid amount.",
    insufficient:
      "The requested amount exceeds your available balance.",

    requestSuccess:
      "Your withdrawal request was recorded and will be reviewed by TIKEMIA administration.",

    pendingAmount: "Pending withdrawals",
    completedAmount: "Completed withdrawals",

    historyTitle: "Withdrawal history",
    historySubtitle:
      "Track the status of your withdrawal requests.",

    all: "All",
    pending: "Pending",
    completed: "Completed",
    rejected: "Rejected",

    reference: "Reference",
    date: "Date",
    account: "Method",
    status: "Status",
    amountColumn: "Amount",

    requested: "Requested",
    underReview: "Under review",
    approved: "Approved",
    processing: "Processing",
    finished: "Completed",
    failed: "Failed",
    refused: "Rejected",
    cancelled: "Cancelled",

    noHistory: "No withdrawals to display.",
    refresh: "Refresh",
    loading: "Loading your withdrawals...",
    loadError: "Unable to load withdrawal information.",
    retry: "Try again",
    close: "Close",
    cancel: "Cancel",
    page: "Page",
    of: "of",
    organization: "Organization",
    currency: "Currency",

    secure:
      "Your request will be reviewed by administration. No transfer is performed immediately.",

    notProvided: "Not provided",
    multiCurrency: "Balances are displayed separately by currency.",
    noBalance: "No balance available in this currency.",
  },
} as const;

/* ==========================================================
   UTILITAIRES
========================================================== */

function record(value: unknown): JsonRecord {
  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as JsonRecord;
  }

  return {};
}

function stringValue(
  value: unknown,
  fallback = ""
): string {
  return typeof value === "string" ? value : fallback;
}

function booleanValue(value: unknown): boolean {
  return value === true;
}

function numberValue(
  value: unknown,
  fallback = 0
): number {
  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : fallback;
}

function minorString(
  value: unknown,
  fallback = "0"
): string {
  if (
    typeof value === "string" &&
    /^-?\d+$/.test(value)
  ) {
    return value;
  }

  if (
    typeof value === "number" &&
    Number.isSafeInteger(value)
  ) {
    return String(value);
  }

  return fallback;
}

function parseMinor(value: string): bigint {
  try {
    return /^-?\d+$/.test(value) ? BigInt(value) : 0n;
  } catch {
    return 0n;
  }
}

function isMethodType(value: unknown): value is PaymentMethodType {
  return (
    value === "MOBILE_MONEY" ||
    value === "BANK_ACCOUNT" ||
    value === "CRYPTO"
  );
}

function normalizeMethod(value: unknown): WithdrawalMethod | null {
  const item = record(value);

  if (
    typeof item.id !== "string" ||
    !UUID_REGEX.test(item.id) ||
    !isMethodType(item.type)
  ) {
    return null;
  }

  return {
    id: item.id,
    organizationId: stringValue(item.organizationId),
    type: item.type,
    provider: stringValue(item.provider),
    accountName: stringValue(item.accountName),
    maskedAccountRef: stringValue(item.maskedAccountRef),
    label: stringValue(item.label),
    bankName: stringValue(item.bankName),
    assetCode: stringValue(item.assetCode),
    networkCode: stringValue(item.networkCode),
    currency: stringValue(item.currency, "XOF"),
    countryCode: stringValue(item.countryCode),
    isVerified: booleanValue(item.isVerified),
    isDefault: booleanValue(item.isDefault),
  };
}

function normalizeWithdrawal(value: unknown): Withdrawal | null {
  const item = record(value);

  if (typeof item.id !== "string") {
    return null;
  }

  const destination = record(item.destination);

  return {
    id: item.id,
    reference: stringValue(item.reference),
    destinationId: stringValue(item.destinationId),
    amountMinor: minorString(item.amountMinor ?? item.amount),
    currency: stringValue(item.currency, "XOF"),
    status: stringValue(item.status, "REQUESTED"),
    requestedAt: stringValue(item.requestedAt),
    completedAt:
      typeof item.completedAt === "string"
        ? item.completedAt
        : null,
    destination: {
      type: stringValue(destination.type),
      provider: stringValue(destination.provider),
      maskedAccountRef: stringValue(
        destination.maskedAccountRef
      ),
      accountName: stringValue(destination.accountName),
      bankName: stringValue(destination.bankName),
      assetCode: stringValue(destination.assetCode),
      networkCode: stringValue(destination.networkCode),
    },
  };
}

function normalizeBalance(
  value: unknown,
  currency: string
): Balance {
  const balance = record(value);
  const minor = record(balance.minor);

  return {
    gross: minorString(minor.gross ?? balance.gross),
    commission: minorString(
      minor.commission ?? balance.commission
    ),
    net: minorString(minor.net ?? balance.net),
    available: minorString(
      minor.available ?? balance.available
    ),
    pending: minorString(minor.pending ?? balance.pending),
    completed: minorString(
      minor.completed ?? balance.completed
    ),
    currency: stringValue(balance.currency, currency),
  };
}

function normalizeWithdrawalsResponse(
  value: unknown,
  currency: string
): WithdrawalsResponse {
  const data = record(value);
  const pagination = record(data.pagination);

  const source = Array.isArray(data.withdrawals)
    ? data.withdrawals
    : Array.isArray(data.history)
      ? data.history
      : [];

  return {
    balance: normalizeBalance(
      data.balance ?? data.summary,
      currency
    ),
    history: source
      .map(normalizeWithdrawal)
      .filter(
        (item): item is Withdrawal => item !== null
      ),
    pagination: {
      page: numberValue(pagination.page, 1),
      total: numberValue(pagination.total),
      totalPages: Math.max(
        1,
        numberValue(pagination.totalPages, 1)
      ),
      hasNext: booleanValue(pagination.hasNext),
      hasPrevious: booleanValue(pagination.hasPrevious),
    },
  };
}

async function requestJson(
  url: string,
  options: RequestInit = {}
): Promise<JsonRecord> {
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    ...options,
  });

  let data: JsonRecord = {};

  try {
    data = record(await response.json());
  } catch {
    data = {};
  }

  if (!response.ok || data.success !== true) {
    throw new Error(
      stringValue(data.message) || `HTTP ${response.status}`
    );
  }

  return data;
}

/* ==========================================================
   GESTION DES MONTANTS

   Toutes les données API sont en unités
   monétaires mineures.

   Exemples :
   XOF : 10000 = 10 000 FCFA
   EUR : 10000 = 100,00 €

   Aucune addition ou soustraction en
   nombres flottants pour les soldes.
========================================================== */

function currencyDigits(currency: string): number {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

function formatMoney(
  minor: string | bigint,
  currency: string,
  locale: Locale
): string {
  const amount =
    typeof minor === "bigint" ? minor : parseMinor(minor);

  const digits = currencyDigits(currency);
  const factor = 10n ** BigInt(digits);

  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;

  const whole = absolute / factor;
  const fraction = absolute % factor;

  const fractionText =
    digits > 0
      ? `,${fraction.toString().padStart(digits, "0")}`
      : "";

  const wholeText = new Intl.NumberFormat(
    locale === "fr" ? "fr-FR" : "en-GB"
  ).format(whole);

  const prefix = negative ? "-" : "";

  if (currency === "XOF" || currency === "XAF") {
    return `${prefix}${wholeText}${fractionText} ${currencySymbol(currency)}`;
  }

  if (currency === "EUR") {
    return locale === "fr"
      ? `${prefix}${wholeText}${fractionText} €`
      : `€${prefix}${wholeText}${fractionText.replace(",", ".")}`;
  }

  if (currency === "USD") {
    return locale === "fr"
      ? `${prefix}${wholeText}${fractionText} $`
      : `$${prefix}${wholeText}${fractionText.replace(",", ".")}`;
  }

  return `${prefix}${wholeText}${fractionText} ${currencySymbol(currency)}`;
}

function formatDate(
  value: string,
  locale: Locale
): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    locale === "fr" ? "fr-FR" : "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(date);
}

function parseWithdrawalAmount(
  input: string,
  currency: string
): bigint | null {
  const normalized = input.trim().replace(",", ".");

  if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
    return null;
  }

  const digits = currencyDigits(currency);
  const [whole, fractional = ""] = normalized.split(".");

  if (fractional.length > digits) {
    return null;
  }

  try {
    const factor = 10n ** BigInt(digits);

    const value =
      BigInt(whole) * factor +
      BigInt(fractional.padEnd(digits, "0") || "0");

    return value > 0n ? value : null;
  } catch {
    return null;
  }
}

function minorToInput(
  amount: string,
  currency: string
): string {
  const value = parseMinor(amount);
  const digits = currencyDigits(currency);
  const factor = 10n ** BigInt(digits);

  if (digits === 0) {
    return value.toString();
  }

  const whole = value / factor;
  const fraction = (value % factor)
    .toString()
    .padStart(digits, "0");

  return `${whole}.${fraction}`;
}

/* ==========================================================
   LOGOS DES MOYENS DE PAIEMENT

   Utilisation des SVG existants :
   public/payment-logos/

   Banque :
   bank.svg
========================================================== */

const PAYMENT_LOGOS: Record<string, string> = {
  MTN_MOMO: "/payment-logos/mtn-momo.svg",
  MTN_MONEY: "/payment-logos/mtn-momo.svg",
  MOOV_MONEY: "/payment-logos/moov-money.svg",
  ORANGE_MONEY: "/payment-logos/orange-money.svg",
  WAVE: "/payment-logos/wave.svg",
  AIRTEL_MONEY: "/payment-logos/airtel-money.svg",
  MPESA: "/payment-logos/mpesa.svg",
  M_PESA: "/payment-logos/mpesa.svg",
  ECOCASH: "/payment-logos/ecocash.svg",
  TMONEY: "/payment-logos/t-money.svg",
  T_MONEY: "/payment-logos/t-money.svg",
  MIXX: "/payment-logos/mixx.svg",
  MIXX_BY_YAS: "/payment-logos/mixx.svg",
  BANK_TRANSFER: "/payment-logos/bank.svg",
  BTC: "/payment-logos/bitcoin.svg",
  BITCOIN: "/payment-logos/bitcoin.svg",
  USDT: "/payment-logos/usdt.svg",
};

function methodLogo(method: {
  type: string;
  provider: string;
  assetCode?: string;
}): string | null {
  if (method.type === "BANK_ACCOUNT") {
    return PAYMENT_LOGOS.BANK_TRANSFER;
  }

  if (method.type === "CRYPTO") {
    return (
      PAYMENT_LOGOS[method.assetCode?.toUpperCase() ?? ""] ??
      PAYMENT_LOGOS[method.provider.toUpperCase()] ??
      null
    );
  }

  return PAYMENT_LOGOS[method.provider.toUpperCase()] ?? null;
}

function methodName(
  method: {
    type: string;
    provider: string;
    bankName?: string;
    assetCode?: string;
    networkCode?: string;
  },
  locale: Locale
): string {
  if (method.type === "BANK_ACCOUNT") {
    return method.bankName ||
      (locale === "fr" ? "Compte bancaire" : "Bank account");
  }

  if (method.type === "CRYPTO") {
    return [
      method.assetCode || method.provider,
      method.networkCode,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  const names: Record<string, string> = {
    MTN_MOMO: "MTN MoMo",
    MTN_MONEY: "MTN MoMo",
    MOOV_MONEY: "Moov Money",
    ORANGE_MONEY: "Orange Money",
    WAVE: "Wave",
    AIRTEL_MONEY: "Airtel Money",
    MPESA: "M-Pesa",
    M_PESA: "M-Pesa",
    ECOCASH: "EcoCash",
    TMONEY: "T-Money",
    T_MONEY: "T-Money",
    MIXX: "Mixx",
    MIXX_BY_YAS: "Mixx by Yas",
  };

  return names[method.provider.toUpperCase()] ??
    method.provider.replaceAll("_", " ");
}

/* ==========================================================
   COMPOSANTS LOCAUX
========================================================== */

const PANEL =
  "w-full min-w-0 rounded-2xl border border-[#e0e8ed] bg-white p-3 shadow-sm sm:p-4 lg:p-5";

const PRIMARY =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#087e30] px-5 py-2.5 text-sm font-extrabold text-white transition-colors hover:bg-[#056e28] disabled:cursor-not-allowed disabled:opacity-50";

const SECONDARY =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#d8e2e9] bg-white px-4 py-2 text-sm font-bold text-[#34506b] transition-colors hover:bg-[#f3f8f5] disabled:cursor-not-allowed disabled:opacity-50";

const INPUT =
  "h-11 w-full min-w-0 rounded-xl border border-[#d8e2e9] bg-white px-3 text-sm font-semibold text-[#17273f] outline-none transition-colors focus:border-[#08882e] focus:ring-2 focus:ring-green-100";

function MethodIcon({
  method,
  size = "md",
}: {
  method: {
    type: string;
    provider: string;
    assetCode?: string;
  };
  size?: "sm" | "md";
}) {
  const [failed, setFailed] = useState(false);
  const logo = methodLogo(method);

  const dimensions =
    size === "sm"
      ? "size-10"
      : "size-12 sm:size-13";

  const fallback =
    method.type === "BANK_ACCOUNT" ? (
      <Landmark size={24} />
    ) : method.type === "CRYPTO" ? (
      <Coins size={24} />
    ) : (
      <Smartphone size={24} />
    );

  return (
    <span
      className={`flex ${dimensions} shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#e8edf0] bg-white p-1.5 text-[#087e30]`}
    >
      {logo && !failed ? (
        <Image
          src={logo}
          width={52}
          height={52}
          unoptimized
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-contain"
        />
      ) : (
        fallback
      )}
    </span>
  );
}

function Metric({
  title,
  amount,
  currency,
  locale,
  icon,
  tone,
}: {
  title: string;
  amount: string;
  currency: string;
  locale: Locale;
  icon: ReactNode;
  tone: "green" | "yellow" | "mint" | "blue";
}) {
  const colors = {
    green: "bg-[#e7f7e9] text-[#08702a]",
    yellow: "bg-[#fff6dc] text-[#896600]",
    mint: "bg-[#e8f8f1] text-[#067a50]",
    blue: "bg-[#e8f3ff] text-[#1d5c92]",
  };

  return (
    <div
      className={`flex min-w-0 items-center gap-3 rounded-xl p-3 sm:p-4 ${colors[tone]}`}
    >
      <div className="shrink-0">{icon}</div>

      <div className="min-w-0">
        <p className="text-[11px] font-bold leading-snug sm:text-xs">
          {title}
        </p>

        <p className="mt-1 wrap-break-word text-base font-extrabold sm:text-xl">
          {formatMoney(amount, currency, locale)}
        </p>
      </div>
    </div>
  );
}

function WithdrawalStatus({
  status,
  locale,
}: {
  status: string;
  locale: Locale;
}) {
  const t = TEXT[locale];

  const labels: Record<string, string> = {
    REQUESTED: t.requested,
    UNDER_REVIEW: t.underReview,
    APPROVED: t.approved,
    PROCESSING: t.processing,
    COMPLETED: t.finished,
    FAILED: t.failed,
    REJECTED: t.refused,
    CANCELLED: t.cancelled,
  };

  const upper = status.toUpperCase();

  const success = upper === "COMPLETED";

  const rejected = STATUS_GROUPS.rejected.some(
    (item) => item === upper
  );

  const color = success
    ? "bg-green-100 text-green-800"
    : rejected
      ? "bg-red-100 text-red-700"
      : "bg-amber-100 text-amber-800";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold ${color}`}
    >
      {success ? (
        <CheckCircle2 size={14} />
      ) : (
        <Clock3 size={14} />
      )}
      {labels[upper] ?? upper}
    </span>
  );
}

/* ==========================================================
   PAGE PRINCIPALE
========================================================== */

export default function OrganizerWithdrawalsPage() {
  const [locale, setLocale] = useState<Locale>("fr");

  const [organizations, setOrganizations] =
    useState<Organization[]>([]);

  const [organizationId, setOrganizationId] =
    useState("");

  const [email, setEmail] = useState("");

  const [methods, setMethods] =
    useState<WithdrawalMethod[]>([]);

  const [selectedMethodId, setSelectedMethodId] =
    useState("");

  const [currency, setCurrency] =
    useState("XOF");

  const [financialData, setFinancialData] =
    useState<WithdrawalsResponse | null>(null);

  const [historyFilter, setHistoryFilter] =
    useState<HistoryFilter>("all");

  const [page, setPage] = useState(1);

  const [amountInput, setAmountInput] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const [notice, setNotice] =
    useState<Notice | null>(null);

  const [verifyMethodId, setVerifyMethodId] =
    useState<string | null>(null);

  const [verificationStep, setVerificationStep] =
    useState<VerificationStep>("closed");

  const [otp, setOtp] = useState("");
  const [confirmedDetails, setConfirmedDetails] =
    useState(false);

  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const [resendSeconds, setResendSeconds] = useState(0);

  const [maskedEmail, setMaskedEmail] = useState("");

  const pendingRequestKey = useRef<string | null>(null);
  const initialLoadCompleted = useRef(false);

  const t = TEXT[locale];

  /* ========================================================
     LANGUE

     Lecture des préférences déjà utilisées
     dans le projet TIKEMIA.
  ======================================================== */

  useEffect(() => {
    function syncLanguage() {
      try {
        const saved =
          localStorage.getItem("tikemia_locale");

        setLocale(saved === "en" ? "en" : "fr");
      } catch {
        setLocale("fr");
      }
    }

    syncLanguage();

    window.addEventListener("storage", syncLanguage);

    window.addEventListener(
      "tikemia:locale-changed",
      syncLanguage
    );

    return () => {
      window.removeEventListener("storage", syncLanguage);
      window.removeEventListener(
        "tikemia:locale-changed",
        syncLanguage
      );
    };
  }, []);

  /* ========================================================
     COMPTE ORGANISATEUR
  ======================================================== */

  const loadProfile = useCallback(async () => {
    const response = await requestJson(API.profile);

    const profile = record(response.profile);

    const id = stringValue(profile.organizationId);

    if (!UUID_REGEX.test(id)) {
      throw new Error(
        "Organisation introuvable dans votre profil."
      );
    }

    const availableOrganizations = Array.isArray(
      profile.organizations
    )
      ? profile.organizations
          .map((item) => {
            const entry = record(item);

            return {
              id: stringValue(entry.id),
              name: stringValue(entry.name),
            };
          })
          .filter((item) => UUID_REGEX.test(item.id))
      : [];

    setOrganizations(
      availableOrganizations.length > 0
        ? availableOrganizations
        : [
            {
              id,
              name: stringValue(profile.organizationName),
            },
          ]
    );

    setEmail(stringValue(profile.email));

    setOrganizationId(id);

    return id;
  }, []);

  /* ========================================================
     MOYENS DE RETRAIT
  ======================================================== */

  const loadMethods = useCallback(
    async (orgId: string) => {
      const params = new URLSearchParams({
        organizationId: orgId,
        page: "1",
        pageSize: "50",
      });

      const response = await requestJson(
        `${API.methods}?${params.toString()}`
      );

      const items = Array.isArray(response.destinations)
        ? response.destinations
        : Array.isArray(response.methods)
          ? response.methods
          : [];

      const normalized = items
        .map(normalizeMethod)
        .filter(
          (item): item is WithdrawalMethod =>
            item !== null && item.organizationId === orgId
        );

      setMethods(normalized);

      return normalized;
    },
    []
  );

  /* ========================================================
     SOLDES + HISTORIQUE

     Les montants viennent directement
     de l'API serveur.
  ======================================================== */

  const loadWithdrawals = useCallback(
    async (
      orgId: string,
      selectedCurrency: string,
      selectedPage: number
    ) => {
      const params = new URLSearchParams({
        organizationId: orgId,
        currency: selectedCurrency,
        page: String(selectedPage),
        pageSize: String(PAGE_SIZE),
      });

      const response = await requestJson(
        `${API.withdrawals}?${params.toString()}`
      );

      const normalized =
        normalizeWithdrawalsResponse(
          response,
          selectedCurrency
        );

      setFinancialData(normalized);

      return normalized;
    },
    []
  );

  /* ========================================================
     CHARGEMENT INITIAL
  ======================================================== */

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      setLoading(true);
      setNotice(null);

      try {
        const orgId = await loadProfile();

        if (cancelled) return;

        const availableMethods = await loadMethods(orgId);

        if (cancelled) return;

        const defaultMethod =
          availableMethods.find((item) => item.isDefault) ??
          availableMethods[0];

        const initialCurrency =
          defaultMethod?.currency ?? "XOF";

        setCurrency(initialCurrency);
        setSelectedMethodId(defaultMethod?.id ?? "");

        await loadWithdrawals(
          orgId,
          initialCurrency,
          1
        );

        if (!cancelled) {
          initialLoadCompleted.current = true;
        }
      } catch (error) {
        if (!cancelled) {
          setNotice({
            kind: "error",
            message:
              error instanceof Error
                ? error.message
                : TEXT.fr.loadError,
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [
    loadProfile,
    loadMethods,
    loadWithdrawals,
  ]);

  /* ========================================================
     RECHARGEMENT DES DONNÉES

     La liste, les soldes et les statuts sont
     relus côté serveur.

     Actualisation toutes les 30 secondes.
  ======================================================== */

  const refreshData = useCallback(
    async (silent = false) => {
      if (!organizationId) return;

      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        await Promise.all([
          loadMethods(organizationId),
          loadWithdrawals(
            organizationId,
            currency,
            page
          ),
        ]);
      } catch (error) {
        setNotice({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : TEXT.fr.loadError,
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      organizationId,
      currency,
      page,
      loadMethods,
      loadWithdrawals,
    ]
  );

  useEffect(() => {
    if (
      !initialLoadCompleted.current ||
      !organizationId
    ) {
      return;
    }

    void loadWithdrawals(
      organizationId,
      currency,
      page
    ).catch((error) => {
      setNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : TEXT.fr.loadError,
      });
    });
  }, [
    organizationId,
    currency,
    page,
    loadWithdrawals,
  ]);

  useEffect(() => {
    if (!organizationId) return;

    const refreshVisible = () => {
      if (document.visibilityState === "visible" && !requesting && !verifyingOtp) void refreshData(true);
    };
    const timer = window.setInterval(refreshVisible, REFRESH_INTERVAL_MS);
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refreshVisible); document.removeEventListener("visibilitychange", refreshVisible); };
  }, [
    organizationId,
    requesting,
    verifyingOtp,
    refreshData,
  ]);

  /* ========================================================
     DÉCOMPTE DU RENVOI OTP
  ======================================================== */

  useEffect(() => {
    if (resendSeconds <= 0) return;

    const timer = window.setTimeout(
      () => setResendSeconds((value) => Math.max(0, value - 1)),
      1000
    );

    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  /* ========================================================
     ORGANISATION / DEVISE
  ======================================================== */

  const currencies = SUPPORTED_CURRENCIES;

  const visibleMethods = useMemo(
    () =>
      methods.filter(
        (method) => method.currency === currency
      ),
    [methods, currency]
  );

  const selectedMethod = useMemo(
    () =>
      methods.find(
        (method) => method.id === selectedMethodId
      ) ?? null,
    [methods, selectedMethodId]
  );

  const verifyingMethod = useMemo(
    () =>
      methods.find(
        (method) => method.id === verifyMethodId
      ) ?? null,
    [methods, verifyMethodId]
  );

  const balance = financialData?.balance ?? {
    gross: "0",
    commission: "0",
    net: "0",
    available: "0",
    pending: "0",
    completed: "0",
    currency,
  };

  const available = parseMinor(balance.available);

  const requestedMinor = useMemo(
    () => parseWithdrawalAmount(amountInput, currency),
    [amountInput, currency]
  );

  const amountValid =
    requestedMinor !== null &&
    requestedMinor > 0n &&
    requestedMinor <= available;

  const history = useMemo(() => {
    const items = financialData?.history ?? [];

    if (historyFilter === "all") {
      return items;
    }

    const statuses = STATUS_GROUPS[historyFilter];

    return items.filter((withdrawal) =>
      statuses.some(
        (status) =>
          status === withdrawal.status.toUpperCase()
      )
    );
  }, [financialData, historyFilter]);

  /* ========================================================
     SÉLECTION D'UN MOYEN
  ======================================================== */

  function chooseMethod(method: WithdrawalMethod) {
    setSelectedMethodId(method.id);
    setNotice(null);
    pendingRequestKey.current = null;

    if (method.currency !== currency) {
      setCurrency(method.currency);
      setPage(1);
      setAmountInput("");
    }

    if (!method.isVerified) {
      setNotice({
        kind: "info",
        message: t.verifyFirst,
      });
    }
  }

  /* ========================================================
     OUVRIR LA VALIDATION OTP
  ======================================================== */

  function openVerification(method: WithdrawalMethod) {
    setVerifyMethodId(method.id);
    setVerificationStep("send");
    setOtp("");
    setConfirmedDetails(false);
    setResendSeconds(0);
    setMaskedEmail("");
    setNotice(null);
  }

  function closeVerification() {
    if (sendingOtp || verifyingOtp) return;

    setVerifyMethodId(null);
    setVerificationStep("closed");
    setOtp("");
    setConfirmedDetails(false);
    setResendSeconds(0);
  }

  /* ========================================================
     ENVOI DU CODE EMAIL
  ======================================================== */

  async function sendVerificationCode() {
    if (!verifyMethodId || sendingOtp) return;

    setSendingOtp(true);
    setNotice(null);

    try {
      const response = await requestJson(
        API.verification,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "send",
            destinationId: verifyMethodId,
          }),
        }
      );

      setMaskedEmail(
        stringValue(response.email, email)
      );

      setResendSeconds(
        numberValue(response.resendAfter, 60)
      );

      setVerificationStep("confirm");

      setNotice({
        kind: "success",
        message: stringValue(
          response.message,
          t.codeSent
        ),
      });
    } catch (error) {
      setNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : t.loadError,
      });
    } finally {
      setSendingOtp(false);
    }
  }

  /* ========================================================
     CONFIRMATION OTP

     Le serveur vérifie :
     - Code
     - Expiration
     - Nombre d'essais
     - Propriétaire du compte
     - Coordonnées inchangées
     - Confirmation explicite
  ======================================================== */

  async function confirmVerification(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!verifyMethodId || verifyingOtp) return;

    if (!/^\d{6}$/.test(otp)) {
      setNotice({
        kind: "error",
        message: t.codeRequired,
      });
      return;
    }

    if (!confirmedDetails) {
      setNotice({
        kind: "error",
        message: t.checkboxRequired,
      });
      return;
    }

    setVerifyingOtp(true);
    setNotice(null);

    try {
      const response = await requestJson(
        API.verification,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "confirm",
            destinationId: verifyMethodId,
            code: otp,
            confirmDetails: true,
          }),
        }
      );

      await loadMethods(organizationId);

      setSelectedMethodId(verifyMethodId);

      setVerifyMethodId(null);
      setVerificationStep("closed");
      setOtp("");
      setConfirmedDetails(false);

      setNotice({
        kind: "success",
        message: stringValue(
          response.message,
          t.validatedMessage
        ),
      });
    } catch (error) {
      setNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : t.loadError,
      });
    } finally {
      setVerifyingOtp(false);
    }
  }

  /* ========================================================
     MONTANT MAXIMUM
  ======================================================== */

  function fillMaximum() {
    if (available > 0n) {
      setAmountInput(
        minorToInput(
          available.toString(),
          currency
        )
      );

      pendingRequestKey.current = null;
    }
  }

  /* ========================================================
     DEMANDE DE RETRAIT

     Le serveur valide réellement le solde.

     La clé d'idempotence est conservée
     si une erreur réseau survient après
     l'envoi de la demande.
  ======================================================== */

  async function submitWithdrawal(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (requesting) return;

    if (!selectedMethod) {
      setNotice({
        kind: "error",
        message: t.chooseMethod,
      });
      return;
    }

    if (!selectedMethod.isVerified) {
      setNotice({
        kind: "error",
        message: t.verifyFirst,
      });

      openVerification(selectedMethod);
      return;
    }

    if (!amountValid || requestedMinor === null) {
      setNotice({
        kind: "error",
        message:
          requestedMinor !== null && requestedMinor > available
            ? t.insufficient
            : t.invalidAmount,
      });
      return;
    }

    if (!organizationId) {
      setNotice({
        kind: "error",
        message: t.loadError,
      });
      return;
    }

    setRequesting(true);
    setNotice(null);

    const idempotencyKey =
      pendingRequestKey.current ??
      crypto.randomUUID();

    pendingRequestKey.current = idempotencyKey;

    try {
      const response = await requestJson(
        API.withdrawals,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify({
            organizationId,
            destinationId: selectedMethod.id,
            amount: requestedMinor.toString(),
            currency,
          }),
        }
      );

      pendingRequestKey.current = null;
      setAmountInput("");
      setPage(1);
      setHistoryFilter("all");

      await loadWithdrawals(
        organizationId,
        currency,
        1
      );

      setNotice({
        kind: "success",
        message: stringValue(
          response.message,
          t.requestSuccess
        ),
      });
    } catch (error) {
      setNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : t.loadError,
      });
    } finally {
      setRequesting(false);
    }
  }

  /* ========================================================
     RENDU INITIAL
  ======================================================== */

  if (loading && !financialData) {
    return (
      <main className="flex min-h-[75vh] w-full items-center justify-center bg-[#f6f9fb] p-4">
        <div
          role="status"
          className="flex flex-col items-center gap-3 text-center"
        >
          <LoaderCircle
            size={36}
            className="animate-spin text-[#087e30]"
          />

          <p className="text-sm font-semibold text-[#68768a]">
            {t.loading}
          </p>
        </div>
      </main>
    );
  }

  /* ========================================================
     PAGE RETRAITS
  ======================================================== */

  return (
    <main className="flex min-h-full w-full min-w-0 flex-col overflow-x-hidden bg-[#f6f9fb] pb-2 text-[#15243c]">
      {/* ====================================================
          EN-TÊTE

          Aucun nouveau menu global.
      ==================================================== */}

      <header className="relative w-full overflow-hidden border-b border-[#e0e8ed] bg-white">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-r from-[#e6f9df] via-[#f3ffe8] to-[#fff4dc]" />

        <div className="relative flex w-full flex-col gap-4 px-3 py-5 sm:px-5 lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#e4f7e8] text-[#087e30] sm:size-14">
              <ArrowDownToLine size={27} />
            </div>

            <div className="min-w-0">
              <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl lg:text-3xl">
                {t.pageTitle}
              </h1>

              <p className="mt-1 text-xs text-[#65758a] sm:text-sm">
                {t.subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void refreshData(true)}
            disabled={refreshing}
            className={SECONDARY}
          >
            <RefreshCw
              size={18}
              className={refreshing ? "animate-spin" : ""}
            />
            {t.refresh}
          </button>
        </div>

        <div className="relative h-1 w-full bg-linear-to-r from-[#09862c] via-[#80dc20] to-[#ffc827]" />
      </header>

      {/* ====================================================
          CONTENU PLEINE LARGEUR
      ==================================================== */}

      <div className="flex w-full min-w-0 flex-1 flex-col gap-4 p-3 sm:p-5 lg:gap-5 lg:p-6">
        {/* NOTIFICATIONS */}

        {notice && (
          <div
            role={
              notice.kind === "error" ? "alert" : "status"
            }
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm font-semibold ${
              notice.kind === "success"
                ? "border-green-200 bg-green-50 text-green-800"
                : notice.kind === "info"
                  ? "border-blue-200 bg-blue-50 text-blue-800"
                  : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {notice.kind === "success" ? (
              <CheckCircle2 size={20} className="shrink-0" />
            ) : notice.kind === "info" ? (
              <Info size={20} className="shrink-0" />
            ) : (
              <CircleAlert size={20} className="shrink-0" />
            )}

            <span className="min-w-0 flex-1 wrap-break-word">
              {notice.message}
            </span>

            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label={t.close}
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* ORGANISATION ET DEVISE */}

        <div className="flex flex-col gap-3 rounded-xl border border-[#e0e8ed] bg-white p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="flex min-w-0 items-center gap-2">
            <Building2
              size={19}
              className="shrink-0 text-[#087b2b]"
            />

            {organizations.length > 1 ? (
              <select
                aria-label={t.organization}
                value={organizationId}
                onChange={async (event) => {
                  const nextId = event.target.value;

                  setOrganizationId(nextId);
                  setSelectedMethodId("");
                  setAmountInput("");
                  setPage(1);
                  setFinancialData(null);
                  pendingRequestKey.current = null;
                  setLoading(true);

                  try {
                    const nextMethods =
                      await loadMethods(nextId);

                    const defaultMethod =
                      nextMethods.find(
                        (method) => method.isDefault
                      ) ?? nextMethods[0];

                    const nextCurrency =
                      defaultMethod?.currency ?? "XOF";

                    setCurrency(nextCurrency);
                    setSelectedMethodId(
                      defaultMethod?.id ?? ""
                    );

                    await loadWithdrawals(
                      nextId,
                      nextCurrency,
                      1
                    );
                  } catch (error) {
                    setNotice({
                      kind: "error",
                      message:
                        error instanceof Error
                          ? error.message
                          : t.loadError,
                    });
                  } finally {
                    setLoading(false);
                  }
                }}
                className={`${INPUT} max-w-full sm:w-72`}
              >
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="min-w-0 wrap-break-word text-sm font-extrabold">
                {organizations[0]?.name || t.organization}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="shrink-0 text-xs font-bold text-[#607086]">
              {t.currency}
            </span>

            <select
              value={currency}
              onChange={(event) => {
                const nextCurrency = event.target.value;

                setCurrency(nextCurrency);
                setPage(1);
                setAmountInput("");
                pendingRequestKey.current = null;

                const defaultMethod =
                  methods.find(
                    (method) =>
                      method.currency === nextCurrency &&
                      method.isDefault
                  ) ??
                  methods.find(
                    (method) =>
                      method.currency === nextCurrency
                  );

                setSelectedMethodId(
                  defaultMethod?.id ?? ""
                );
              }}
              className={`${INPUT} sm:w-44`}
            >
              {currencies.map((code) => (
                <option key={code} value={code}>
                  {currencyLabel(code, locale)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ==================================================
            SOLDES — 4 INDICATEURS
        ================================================== */}

        <section className="grid w-full grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
          <Metric
            title={t.gross}
            amount={balance.gross}
            currency={currency}
            locale={locale}
            icon={<Coins size={25} />}
            tone="green"
          />

          <Metric
            title={t.commission}
            amount={balance.commission}
            currency={currency}
            locale={locale}
            icon={<Ticket size={25} />}
            tone="yellow"
          />

          <Metric
            title={t.net}
            amount={balance.net}
            currency={currency}
            locale={locale}
            icon={<Wallet size={25} />}
            tone="mint"
          />

          <Metric
            title={t.available}
            amount={balance.available}
            currency={currency}
            locale={locale}
            icon={<ArrowDownToLine size={25} />}
            tone="blue"
          />
        </section>

        <div className="flex items-start gap-2 rounded-xl border border-[#d9ebdb] bg-[#eff9f0] p-3 text-xs font-semibold leading-relaxed text-[#366843]">
          <Info size={18} className="shrink-0" />
          <p>{t.moneyInfo}</p>
        </div>

        {/* ==================================================
            MOYENS DE RETRAIT
        ================================================== */}

        <section className={PANEL}>
          <div className="flex flex-col gap-3 border-b border-[#e9eef1] pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-extrabold sm:text-xl">
                <CreditCard
                  size={22}
                  className="text-[#087e30]"
                />
                {t.withdrawalMethods}
              </h2>

              <p className="mt-1 text-xs text-[#69788b] sm:text-sm">
                {t.methodSubtitle}
              </p>
            </div>

            <Link
              href={SETTINGS_URL}
              className={`${SECONDARY} w-full sm:w-auto`}
            >
              <Plus size={17} />
              {t.addMethod}
            </Link>
          </div>

          {methods.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Wallet
                size={36}
                className="text-[#9baba5]"
              />

              <p className="text-sm font-semibold text-[#69798b]">
                {t.noMethods}
              </p>

              <Link href={SETTINGS_URL} className={PRIMARY}>
                <Plus size={18} />
                {t.addMethod}
              </Link>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {methods.map((method) => {
                const selected =
                  selectedMethodId === method.id;

                return (
                  <article
                    key={method.id}
                    className={`min-w-0 rounded-xl border p-3 transition-colors sm:p-4 ${
                      selected
                        ? "border-[#0a8b31] bg-[#f0fbf0] ring-1 ring-[#9bd5a5]"
                        : "border-[#e0e7ec] bg-[#fafcfd]"
                    }`}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <MethodIcon method={method} />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="wrap-break-word text-sm font-extrabold">
                            {method.label ||
                              methodName(method, locale)}
                          </h3>

                          {method.isDefault && (
                            <span className="rounded-full bg-green-100 px-2 py-1 text-[10px] font-bold text-green-800">
                              {t.default}
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-xs font-semibold text-[#5e7184]">
                          {methodName(method, locale)}
                        </p>

                        <p className="mt-1 text-xs text-[#718094]">
                          {method.accountName}
                        </p>

                        <p className="mt-1 font-mono text-xs text-[#384d66]">
                          {method.maskedAccountRef || "••••"}
                        </p>

                        <p className="mt-2 text-[11px] font-semibold text-[#687c8d]">
                          {method.countryCode} · {method.currency}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#e1e9e3] pt-3">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-extrabold ${
                          method.isVerified
                            ? "text-[#07822c]"
                            : "text-[#ad7400]"
                        }`}
                      >
                        {method.isVerified ? (
                          <CheckCircle2 size={15} />
                        ) : (
                          <Clock3 size={15} />
                        )}

                        {method.isVerified
                          ? t.verified
                          : t.unverified}
                      </span>

                      {selected && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-[#087b2b]">
                          <Check size={15} />
                          {t.selected}
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => chooseMethod(method)}
                        className={`min-h-10 flex-1 rounded-lg px-3 text-xs font-extrabold ${
                          selected
                            ? "bg-[#dcf3e0] text-[#08722a]"
                            : "border border-[#d7e3dd] bg-white text-[#294960]"
                        }`}
                      >
                        {selected ? t.selected : t.select}
                      </button>

                      {!method.isVerified && (
                        <button
                          type="button"
                          onClick={() => openVerification(method)}
                          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-[#087e30] px-4 text-xs font-extrabold text-white"
                        >
                          <ShieldCheck size={16} />
                          {t.validate}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {methods.length > 0 && (
            <div className="mt-4 flex justify-end">
              <Link
                href={SETTINGS_URL}
                className="inline-flex items-center gap-2 text-xs font-bold text-[#07812e] hover:underline"
              >
                {t.manageMethods}
                <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </section>

        {/* ==================================================
            DEMANDE DE RETRAIT
        ================================================== */}

        <section className={PANEL}>
          <div className="mb-3 border-b border-[#e9eef1] pb-4">
            <h2 className="flex items-center gap-2 text-lg font-extrabold sm:text-xl">
              <ArrowDownToLine
                size={22}
                className="text-[#087e30]"
              />
              {t.requestTitle}
            </h2>

            <p className="mt-1 text-xs text-[#69788b] sm:text-sm">
              {t.requestSubtitle}
            </p>
          </div>

          <form
            onSubmit={(event) => void submitWithdrawal(event)}
            className="flex flex-col gap-4"
          >
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="min-w-0">
                <label className="mb-1.5 block text-xs font-bold text-[#506078]">
                  {t.withdrawalMethod}
                </label>

                <select
                  value={selectedMethodId}
                  onChange={(event) => {
                    const method = methods.find(
                      (item) =>
                        item.id === event.target.value
                    );

                    if (method) {
                      chooseMethod(method);
                    } else {
                      setSelectedMethodId("");
                    }
                  }}
                  className={INPUT}
                  required
                >
                  <option value="">{t.chooseMethod}</option>

                  {visibleMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {methodName(method, locale)}
                      {" — "}
                      {method.maskedAccountRef}
                      {!method.isVerified
                        ? ` (${t.unverified})`
                        : ""}
                    </option>
                  ))}
                </select>

                {selectedMethod && !selectedMethod.isVerified && (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                    <p className="text-xs font-semibold text-amber-800">
                      {t.verifyFirst}
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        openVerification(selectedMethod)
                      }
                      className="text-xs font-extrabold text-[#08782a] underline"
                    >
                      {t.validate}
                    </button>
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <label className="mb-1.5 block text-xs font-bold text-[#506078]">
                  {t.amount} ({currencySymbol(currency)})
                </label>

                <div className="flex min-w-0 gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    className={INPUT}
                    value={amountInput}
                    onChange={(event) => {
                      setAmountInput(event.target.value);
                      pendingRequestKey.current = null;
                    }}
                    placeholder="0"
                    autoComplete="off"
                    required
                  />

                  <button
                    type="button"
                    onClick={fillMaximum}
                    disabled={available <= 0n}
                    className="shrink-0 rounded-xl border border-[#d8e5da] bg-[#edf8ef] px-3 text-xs font-extrabold text-[#087c2c] disabled:opacity-50"
                  >
                    {t.useMaximum}
                  </button>
                </div>

                <p className="mt-2 text-xs font-semibold text-[#62768a]">
                  {t.availableToWithdraw} :{" "}
                  <span className="font-extrabold text-[#087d30]">
                    {formatMoney(
                      balance.available,
                      currency,
                      locale
                    )}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-xl bg-[#f3f8fb] p-3 text-xs leading-relaxed text-[#60728a]">
              <ShieldCheck
                size={19}
                className="shrink-0 text-[#087b30]"
              />

              {t.secure}
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={
                  requesting ||
                  !selectedMethod ||
                  !selectedMethod.isVerified ||
                  !amountValid ||
                  !financialData
                }
                className={`${PRIMARY} w-full sm:w-auto`}
              >
                {requesting ? (
                  <LoaderCircle
                    size={18}
                    className="animate-spin"
                  />
                ) : (
                  <Send size={18} />
                )}

                {requesting
                  ? t.requesting
                  : t.requestWithdrawal}
              </button>
            </div>
          </form>
        </section>

        {/* ==================================================
            RÉSUMÉ DES RETRAITS
        ================================================== */}

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-xl border border-[#e3e9ee] bg-white p-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <Clock3 size={23} />
            </div>

            <div className="min-w-0">
              <p className="text-xs font-bold text-[#65768b]">
                {t.pendingAmount}
              </p>

              <p className="mt-1 wrap-break-word text-lg font-extrabold">
                {formatMoney(balance.pending, currency, locale)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-[#e3e9ee] bg-white p-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-700">
              <CheckCircle2 size={23} />
            </div>

            <div className="min-w-0">
              <p className="text-xs font-bold text-[#65768b]">
                {t.completedAmount}
              </p>

              <p className="mt-1 wrap-break-word text-lg font-extrabold">
                {formatMoney(
                  balance.completed,
                  currency,
                  locale
                )}
              </p>
            </div>
          </div>
        </section>

        {/* ==================================================
            HISTORIQUE
        ================================================== */}

        <section className={`${PANEL} p-0!`}>
          <div className="flex flex-col gap-3 border-b border-[#e9eef1] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-extrabold sm:text-xl">
                <CalendarDays
                  size={22}
                  className="text-[#087e30]"
                />
                {t.historyTitle}
              </h2>

              <p className="mt-1 text-xs text-[#69788b] sm:text-sm">
                {t.historySubtitle}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {([
                ["all", t.all],
                ["pending", t.pending],
                ["completed", t.completed],
                ["rejected", t.rejected],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setHistoryFilter(value)}
                  className={`min-h-9 rounded-lg px-3 text-xs font-bold ${
                    historyFilter === value
                      ? "bg-[#e4f8e8] text-[#087b2c]"
                      : "bg-[#f2f5f7] text-[#63748a]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* TABLEAU PC */}

          <div className="hidden w-full overflow-x-auto lg:block">
            <table className="w-full min-w-190 border-collapse text-left">
              <thead className="bg-[#f3f6f8] text-xs font-bold text-[#53657b]">
                <tr>
                  <th className="px-5 py-4">{t.reference}</th>
                  <th className="px-5 py-4">{t.date}</th>
                  <th className="px-5 py-4">{t.account}</th>
                  <th className="px-5 py-4">{t.amountColumn}</th>
                  <th className="px-5 py-4">{t.status}</th>
                </tr>
              </thead>

              <tbody>
                {history.map((withdrawal) => (
                  <tr
                    key={withdrawal.id}
                    className="border-t border-[#e8edf1] align-middle text-sm hover:bg-[#fafcfd]"
                  >
                    <td className="px-5 py-4">
                      <span className="break-all font-mono text-xs font-bold text-[#344b64]">
                        {withdrawal.reference}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-xs text-[#5e7085]">
                      {formatDate(
                        withdrawal.requestedAt,
                        locale
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <MethodIcon
                          method={withdrawal.destination}
                          size="sm"
                        />

                        <div>
                          <p className="text-xs font-bold">
                            {methodName(
                              withdrawal.destination,
                              locale
                            )}
                          </p>

                          <p className="mt-1 font-mono text-[11px] text-[#68798d]">
                            {withdrawal.destination
                              .maskedAccountRef || "••••"}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-sm font-extrabold">
                      {formatMoney(
                        withdrawal.amountMinor,
                        withdrawal.currency,
                        locale
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <WithdrawalStatus
                        status={withdrawal.status}
                        locale={locale}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* CARTES MOBILE */}

          <div className="flex flex-col gap-3 p-3 sm:p-4 lg:hidden">
            {history.map((withdrawal) => (
              <article
                key={withdrawal.id}
                className="rounded-xl border border-[#e0e7ee] bg-white p-3 shadow-sm sm:p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="break-all font-mono text-[11px] font-bold text-[#52657d]">
                    {withdrawal.reference}
                  </span>

                  <WithdrawalStatus
                    status={withdrawal.status}
                    locale={locale}
                  />
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <MethodIcon
                    method={withdrawal.destination}
                    size="sm"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-extrabold">
                      {methodName(
                        withdrawal.destination,
                        locale
                      )}
                    </p>

                    <p className="mt-1 font-mono text-xs text-[#6e7e91]">
                      {withdrawal.destination
                        .maskedAccountRef || "••••"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-end justify-between gap-2 border-t border-[#e9eef1] pt-3">
                  <div>
                    <p className="text-xs text-[#718095]">
                      {formatDate(
                        withdrawal.requestedAt,
                        locale
                      )}
                    </p>
                  </div>

                  <p className="text-base font-extrabold text-[#087632]">
                    {formatMoney(
                      withdrawal.amountMinor,
                      withdrawal.currency,
                      locale
                    )}
                  </p>
                </div>
              </article>
            ))}
          </div>

          {history.length === 0 && (
            <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
              <Wallet
                size={35}
                className="text-[#a3b1aa]"
              />

              <p className="text-sm font-semibold text-[#748296]">
                {t.noHistory}
              </p>
            </div>
          )}

          {/* PAGINATION */}

          {financialData &&
            financialData.pagination.totalPages > 1 && (
              <div className="flex flex-col items-center justify-between gap-3 border-t border-[#e9eef1] p-4 sm:flex-row sm:p-5">
                <span className="text-xs font-semibold text-[#718095]">
                  {t.page} {page} {t.of}{" "}
                  {financialData.pagination.totalPages}
                </span>

                <div className="flex gap-2">
                  <button
                    type="button"
                    aria-label="Previous page"
                    disabled={
                      !financialData.pagination.hasPrevious
                    }
                    onClick={() =>
                      setPage((previous) =>
                        Math.max(1, previous - 1)
                      )
                    }
                    className={`${SECONDARY} px-3`}
                  >
                    <ChevronLeft size={18} />
                  </button>

                  <button
                    type="button"
                    aria-label="Next page"
                    disabled={
                      !financialData.pagination.hasNext
                    }
                    onClick={() =>
                      setPage((previous) => previous + 1)
                    }
                    className={`${SECONDARY} px-3`}
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
        </section>


      </div>

      {/* ====================================================
          FENÊTRE OTP

          Compatible PC et mobile.

          Arrière-plan assombri.
          Fenêtre centrée, largeur adaptée.
      ==================================================== */}

      {verificationStep !== "closed" && verifyingMethod && (
        <div
          className="fixed inset-0 z-100 flex items-center justify-center bg-[#0d2034]/65 p-3 sm:p-5"
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="verification-title"
            className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#e7edf1] p-4 sm:p-5">
              <h2
                id="verification-title"
                className="text-base font-extrabold sm:text-lg"
              >
                {t.verificationTitle}
              </h2>

              <button
                type="button"
                onClick={closeVerification}
                disabled={sendingOtp || verifyingOtp}
                aria-label={t.close}
                className="flex size-9 items-center justify-center rounded-lg bg-[#f2f5f7] disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col gap-4 p-4 sm:p-5">
              <div className="flex items-center gap-3 rounded-xl border border-[#dfe7ed] bg-[#f8fafc] p-3">
                <MethodIcon method={verifyingMethod} />

                <div className="min-w-0">
                  <p className="text-sm font-extrabold">
                    {methodName(
                      verifyingMethod,
                      locale
                    )}
                  </p>

                  <p className="mt-1 text-xs text-[#718095]">
                    {verifyingMethod.maskedAccountRef}
                  </p>

                  <p className="mt-1 text-xs text-[#718095]">
                    {verifyingMethod.accountName}
                  </p>
                </div>
              </div>

              {verificationStep === "send" && (
                <>
                  <div className="flex items-start gap-3 rounded-xl bg-[#eef8f0] p-3 text-sm leading-relaxed text-[#365b43]">
                    <Mail
                      size={21}
                      className="shrink-0 text-[#087b2c]"
                    />

                    <p>{t.verificationExplanation}</p>
                  </div>

                  <div className="rounded-xl border border-[#e1e7ed] p-3">
                    <p className="text-xs text-[#718095]">
                      {t.emailDestination}
                    </p>

                    <p className="mt-1 break-all text-sm font-bold">
                      {email || "—"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      void sendVerificationCode()
                    }
                    disabled={sendingOtp}
                    className={`${PRIMARY} w-full`}
                  >
                    {sendingOtp ? (
                      <LoaderCircle
                        size={18}
                        className="animate-spin"
                      />
                    ) : (
                      <Send size={18} />
                    )}

                    {sendingOtp
                      ? t.sendingCode
                      : t.sendCode}
                  </button>
                </>
              )}

              {verificationStep === "confirm" && (
                <form
                  onSubmit={(event) =>
                    void confirmVerification(event)
                  }
                  className="flex flex-col gap-4"
                >
                  <div className="rounded-xl bg-[#eef8f0] p-3 text-xs text-[#356545]">
                    <p className="font-semibold">
                      {t.codeSent}
                    </p>

                    <p className="mt-1 font-bold">
                      {maskedEmail || email}
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="withdrawal-otp"
                      className="mb-2 block text-xs font-bold text-[#53657b]"
                    >
                      {t.enterCode}
                    </label>

                    <input
                      id="withdrawal-otp"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      autoComplete="one-time-code"
                      value={otp}
                      onChange={(event) =>
                        setOtp(
                          event.target.value
                            .replace(/\D/g, "")
                            .slice(0, 6)
                        )
                      }
                      placeholder="000000"
                      className="h-14 w-full rounded-xl border border-[#d9e3e9] bg-white text-center font-mono text-2xl font-extrabold tracking-[0.35em] outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                      required
                    />

                    <p className="mt-2 text-xs text-[#7b899a]">
                      {t.codeExpiration}
                    </p>
                  </div>

                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#dce7e0] bg-[#f9fcf9] p-3">
                    <input
                      type="checkbox"
                      checked={confirmedDetails}
                      onChange={(event) =>
                        setConfirmedDetails(
                          event.target.checked
                        )
                      }
                      className="mt-0.5 size-4 accent-[#087c2d]"
                    />

                    <span className="text-xs font-semibold leading-relaxed text-[#42576b]">
                      {t.confirmDetails}
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={
                      verifyingOtp ||
                      otp.length !== 6 ||
                      !confirmedDetails
                    }
                    className={`${PRIMARY} w-full`}
                  >
                    {verifyingOtp ? (
                      <LoaderCircle
                        size={18}
                        className="animate-spin"
                      />
                    ) : (
                      <ShieldCheck size={18} />
                    )}

                    {verifyingOtp
                      ? t.verifying
                      : t.verifyMethod}
                  </button>

                  <button
                    type="button"
                    disabled={
                      resendSeconds > 0 ||
                      sendingOtp ||
                      verifyingOtp
                    }
                    onClick={() =>
                      void sendVerificationCode()
                    }
                    className="text-center text-xs font-bold text-[#087c2d] disabled:text-[#82908b]"
                  >
                    {resendSeconds > 0
                      ? `${t.resendIn} ${resendSeconds}s`
                      : t.resendCode}
                  </button>
                </form>
              )}

              <button
                type="button"
                onClick={closeVerification}
                disabled={sendingOtp || verifyingOtp}
                className={`${SECONDARY} w-full`}
              >
                {t.cancel}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
